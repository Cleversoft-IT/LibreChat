  847  npm run stop:deployed
  848  sudo systemctl start nginx
  849  sudo certbot renew
  850  sudo systemctl stop nginx
  851  npm run start:deployed
  852  history