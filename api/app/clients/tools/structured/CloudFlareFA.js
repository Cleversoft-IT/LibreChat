const axios = require('axios').default;
const fetch = require('node-fetch');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { Tool } = require('@langchain/core/tools');
const { logger } = require('~/config');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { FileContext, ContentTypes } = require('librechat-data-provider');

class CloudFlareFA extends Tool {
  constructor(fields) {
    super();
    this.override = fields.override ?? false;

    this.userId = fields.userId;
    this.fileStrategy = fields.fileStrategy;
    this.isAgent = fields.isAgent;
    this.returnMetadata = fields.returnMetadata ?? false;

    if (fields.processFileURL) {
      /** @type {processFileURL} Necessary for output to contain all image metadata. */
      this.processFileURL = fields.processFileURL.bind(this);
    }

    this.cloudFlareApiKey = this.getEnvVariable('CLOUDFLARE_API_KEY');

    this.schema = z.object({});

  }

  getEnvVariable(varName) {
    const value = process.env[varName];
    if (!value) {
      throw new Error(`Missing ${varName} environment variable.`);
    }
    return value;
  }

  /**
   * Extract image URLs from text content (markdown, HTML, and bare URLs)
   * @param {string} text - The text to search for image URLs
   * @returns {Array<string>} Array of image URLs found
   */
  extractImageUrls(text) {
    const imageUrls = new Set();
    
    // Match markdown images: ![alt](url)
    const markdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownRegex.exec(text)) !== null) {
      imageUrls.add(match[2]);
    }
    
    // Match HTML img tags: <img src="url" />
    const htmlRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    while ((match = htmlRegex.exec(text)) !== null) {
      imageUrls.add(match[1]);
    }
    
    // Match bare URLs with common image extensions (including query params)
    const extensionRegex = /https?:\/\/[^\s<>"]+\.(png|jpg|jpeg|gif|webp|svg|bmp)(?:\?[^\s<>"]*)?/gi;
    while ((match = extensionRegex.exec(text)) !== null) {
      imageUrls.add(match[0]);
    }
    
    // Match URLs from known image hosting services (without requiring extensions)
    const hostingRegex = /https?:\/\/[^\s<>"]*(?:googleusercontent|imgur|cloudinary|imagekit|imgix|cloudfront)\.com[^\s<>"]*/gi;
    while ((match = hostingRegex.exec(text)) !== null) {
      imageUrls.add(match[0]);
    }
    
    // Filter for valid HTTP/HTTPS URLs and convert Set to Array
    return Array.from(imageUrls).filter(url => url.startsWith('http://') || url.startsWith('https://'));
  }

  /**
   * Download and process an external image URL
   * @param {string} imageUrl - The external image URL to download
   * @returns {Promise<Object>} Object with original URL and local filepath
   */
  async downloadAndProcessImage(imageUrl) {
    try {
      // Fetch the image first
      const fetchOptions = {};
      if (process.env.PROXY) {
        fetchOptions.agent = new HttpsProxyAgent(process.env.PROXY);
      }
      
      logger.debug(`[CloudFlareFA] Downloading image: ${imageUrl}`);
      const imageResponse = await fetch(imageUrl, fetchOptions);
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }

      // Determine file extension from Content-Type header or URL
      let extension = 'jpg';
      let mimeType = 'image/jpeg';
      
      const contentType = imageResponse.headers.get('content-type');
      if (contentType) {
        // Map common image MIME types to extensions
        const mimeToExt = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'image/svg+xml': 'svg',
          'image/bmp': 'bmp',
        };
        
        mimeType = contentType.split(';')[0].trim();
        extension = mimeToExt[mimeType] || 'jpg';
      } else {
        // Fallback to checking URL path
        const urlPath = new URL(imageUrl).pathname;
        const urlExtMatch = urlPath.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i);
        if (urlExtMatch) {
          extension = urlExtMatch[1].toLowerCase();
          const extToMime = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'bmp': 'image/bmp',
          };
          mimeType = extToMime[extension] || 'image/jpeg';
        }
      }
      
      const imageName = `img-${uuidv4()}.${extension}`;
      logger.debug(`[CloudFlareFA] Detected image type: ${mimeType} (extension: ${extension})`);

      // For agent mode, convert to base64
      if (this.isAgent) {
        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return {
          original: imageUrl,
          content: [{
            type: ContentTypes.IMAGE_URL,
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          }],
        };
      }

      // For non-agent mode, save to local storage
      if (this.processFileURL) {
        const result = await this.processFileURL({
          fileStrategy: this.fileStrategy,
          userId: this.userId,
          URL: imageUrl,
          fileName: imageName,
          basePath: 'images',
          context: FileContext.image_generation,
        });

        logger.debug(`[CloudFlareFA] Image saved to path: ${result.filepath}`);
        
        const serverDomain = process.env.DOMAIN_SERVER || 'http://localhost:3080';
        return {
          original: imageUrl,
          local: `${serverDomain}${result.filepath}`,
          filepath: result.filepath,
        };
      }

      // Fallback: return original URL
      return {
        original: imageUrl,
        local: imageUrl,
      };
    } catch (error) {
      logger.error(`[CloudFlareFA] Error processing image ${imageUrl}:`, error);
      return {
        original: imageUrl,
        local: imageUrl,
        error: error.message,
      };
    }
  }

  /**
   * Process text response to download and replace image URLs
   * @param {string} text - The text containing image URLs
   * @returns {Promise<string|Array>} Processed text with local image URLs
   */
  async processImageUrls(text) {
    const imageUrls = this.extractImageUrls(text);
    
    if (imageUrls.length === 0) {
      return text;
    }

    logger.info(`[CloudFlareFA] Found ${imageUrls.length} image(s) to process`);

    // Download and process all images
    const imageResults = await Promise.all(
      imageUrls.map(url => this.downloadAndProcessImage(url))
    );

    // For agent mode, return structured content
    if (this.isAgent) {
      const textContent = {
        type: ContentTypes.TEXT,
        text: text,
      };
      
      const imageContent = imageResults
        .filter(result => result.content)
        .flatMap(result => result.content);
      
      if (imageContent.length > 0) {
        return [[textContent], { content: imageContent }];
      }
    }

    // Replace URLs in text with local paths
    let processedText = text;
    for (const result of imageResults) {
      if (result.local && result.local !== result.original) {
        processedText = processedText.replace(
          new RegExp(result.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          result.local
        );
      }
    }

    return processedText;
  }

  // eslint-disable-next-line no-unused-vars
  async _call(query, _runManager) {
  //  async _call({ query }, _runManager) {

  logger.info(`[CloudFlareFA] Query: ${JSON.stringify(query)}`);

    const body = query;

    let url = this.cloudFlareUrl;
    logger.info(`[CloudFlareFA] Querying CloudFlare: ${url}`);
    logger.info(`[CloudFlareFA] Body: ${JSON.stringify(body)}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cloudFlareApiKey}`
        },
        
        body: JSON.stringify(body)
      });


    // Get json from response
    const text = await response.text();

    // Process any images in the response
    const processedResponse = await this.processImageUrls(text);

    return processedResponse;

    } catch (error) {
      logger.error('[CloudFlareFA] API request failed', error);
      return `[CloudFlareFA] API request failed: ${error.message}`;
    }
  }

}

module.exports = CloudFlareFA;
