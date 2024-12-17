<<<<<<< HEAD
import { useState } from 'react';
import { KeyRoundIcon } from 'lucide-react';
import { AuthType, AgentCapabilities } from 'librechat-data-provider';
import { useFormContext, Controller, useForm, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import {
  Input,
  OGDialog,
=======
import { KeyRoundIcon } from 'lucide-react';
import { AuthType, AgentCapabilities } from 'librechat-data-provider';
import { useFormContext, Controller, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import {
>>>>>>> e391347b9e63d80a2ea382abf2532e30a7190bb5
  Checkbox,
  HoverCard,
  HoverCardContent,
  HoverCardPortal,
  HoverCardTrigger,
<<<<<<< HEAD
  Button,
} from '~/components/ui';
import OGDialogTemplate from '~/components/ui/OGDialogTemplate';
import { useLocalize, useAuthCodeTool } from '~/hooks';
import { CircleHelpIcon } from '~/components/svg';
import { ESide } from '~/common';

type ApiKeyFormData = {
  apiKey: string;
  authType?: string | AuthType;
};

=======
} from '~/components/ui';
import { useLocalize, useCodeApiKeyForm } from '~/hooks';
import { CircleHelpIcon } from '~/components/svg';
import ApiKeyDialog from './ApiKeyDialog';
import { ESide } from '~/common';

>>>>>>> e391347b9e63d80a2ea382abf2532e30a7190bb5
export default function Action({ authType = '', isToolAuthenticated = false }) {
  const localize = useLocalize();
  const methods = useFormContext<AgentForm>();
  const { control, setValue, getValues } = methods;
<<<<<<< HEAD
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const runCodeIsEnabled = useWatch({ control, name: AgentCapabilities.execute_code });

  const { installTool, removeTool } = useAuthCodeTool({ isEntityTool: true });

  const { reset, register, handleSubmit } = useForm<ApiKeyFormData>();
=======
  const {
    onSubmit,
    isDialogOpen,
    setIsDialogOpen,
    handleRevokeApiKey,
    methods: keyFormMethods,
  } = useCodeApiKeyForm({
    onSubmit: () => {
      setValue(AgentCapabilities.execute_code, true, { shouldDirty: true });
    },
    onRevoke: () => {
      setValue(AgentCapabilities.execute_code, false, { shouldDirty: true });
    },
  });

  const runCodeIsEnabled = useWatch({ control, name: AgentCapabilities.execute_code });
>>>>>>> e391347b9e63d80a2ea382abf2532e30a7190bb5
  const isUserProvided = authType === AuthType.USER_PROVIDED;

  const handleCheckboxChange = (checked: boolean) => {
    if (isToolAuthenticated) {
      setValue(AgentCapabilities.execute_code, checked, { shouldDirty: true });
    } else if (runCodeIsEnabled) {
      setValue(AgentCapabilities.execute_code, false, { shouldDirty: true });
    } else {
      setIsDialogOpen(true);
    }
  };

<<<<<<< HEAD
  const onSubmit = (data: { apiKey: string }) => {
    reset();
    installTool(data.apiKey);
    setIsDialogOpen(false);
  };

  const handleRevokeApiKey = () => {
    reset();
    removeTool();
    setIsDialogOpen(false);
  };

=======
>>>>>>> e391347b9e63d80a2ea382abf2532e30a7190bb5
  return (
    <>
      <HoverCard openDelay={50}>
        <div className="flex items-center">
          <Controller
            name={AgentCapabilities.execute_code}
            control={control}
            render={({ field }) => (
              <Checkbox
                {...field}
                checked={runCodeIsEnabled ? runCodeIsEnabled : isToolAuthenticated && field.value}
                onCheckedChange={handleCheckboxChange}
                className="relative float-left mr-2 inline-flex h-4 w-4 cursor-pointer"
                value={field.value.toString()}
                disabled={runCodeIsEnabled ? false : !isToolAuthenticated}
              />
            )}
          />
          <button
            type="button"
            className="flex items-center space-x-2"
            onClick={() => {
              const value = !getValues(AgentCapabilities.execute_code);
              handleCheckboxChange(value);
            }}
          >
            <label
              className="form-check-label text-token-text-primary w-full cursor-pointer"
              htmlFor={AgentCapabilities.execute_code}
            >
<<<<<<< HEAD
              {localize('com_agents_execute_code')}
=======
              {localize('com_ui_run_code')}
>>>>>>> e391347b9e63d80a2ea382abf2532e30a7190bb5
            </label>
          </button>
          <div className="ml-2 flex gap-2">
            {isUserProvided && (isToolAuthenticated || runCodeIsEnabled) && (
              <button type="button" onClick={() => setIsDialogOpen(true)}>
                <KeyRoundIcon className="h-5 w-5 text-text-primary" />
              </button>
            )}
            <HoverCardTrigger>
              <CircleHelpIcon className="h-5 w-5 text-gray-500" />
            </HoverCardTrigger>
          </div>
          <HoverCardPortal>
            <HoverCardContent side={ESide.Top} className="w-80">
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">
<<<<<<< HEAD
                  {/* // TODO: add a Code Interpreter description */}
=======
                  {localize('com_agents_code_interpreter')}
>>>>>>> e391347b9e63d80a2ea382abf2532e30a7190bb5
                </p>
              </div>
            </HoverCardContent>
          </HoverCardPortal>
        </div>
      </HoverCard>
<<<<<<< HEAD
      <OGDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <OGDialogTemplate
          className="w-11/12 sm:w-1/4"
          title={localize('com_agents_tool_not_authenticated')}
          main={
            <form onSubmit={handleSubmit(onSubmit)}>
              <Input
                type="password"
                placeholder="Enter API Key"
                autoComplete="one-time-code"
                readOnly={true}
                onFocus={(e) => (e.target.readOnly = false)}
                {...register('apiKey', { required: true })}
              />
            </form>
          }
          selection={{
            selectHandler: handleSubmit(onSubmit),
            selectClasses: 'bg-green-500 hover:bg-green-600 text-white',
            selectText: localize('com_ui_save'),
          }}
          buttons={
            isUserProvided &&
            isToolAuthenticated && (
              <Button
                onClick={handleRevokeApiKey}
                className="bg-destructive text-white transition-all duration-200 hover:bg-destructive/80"
              >
                {localize('com_ui_revoke')}
              </Button>
            )
          }
          showCancelButton={true}
        />
      </OGDialog>
=======
      <ApiKeyDialog
        isOpen={isDialogOpen}
        onSubmit={onSubmit}
        onRevoke={handleRevokeApiKey}
        onOpenChange={setIsDialogOpen}
        register={keyFormMethods.register}
        isToolAuthenticated={isToolAuthenticated}
        handleSubmit={keyFormMethods.handleSubmit}
        isUserProvided={authType === AuthType.USER_PROVIDED}
      />
>>>>>>> e391347b9e63d80a2ea382abf2532e30a7190bb5
    </>
  );
}
