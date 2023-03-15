import React, { ChangeEvent } from 'react';
import { InlineField, SecretInput } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { TogglTrackDataSourceOptions, ToggleTrackSecureJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<TogglTrackDataSourceOptions> {}

export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;

  // Secure field (only sent to the backend)
  const onApiTokenChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        apiToken: event.target.value,
      },
    });
  };

  const onResetApiToken = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        apiToken: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        apiToken: '',
      },
    });
  };

  const { secureJsonFields } = options;
  const secureJsonData = (options.secureJsonData || {}) as ToggleTrackSecureJsonData;

  return (
    <div className="gf-form-group">
      <InlineField label="API Token" labelWidth={12} tooltip="API token from your https://track.toggl.com/profile page">
        <SecretInput
          isConfigured={(secureJsonFields && secureJsonFields.apiToken) as boolean}
          value={secureJsonData.apiToken || ''}
          placeholder=""
          width={40}
          onReset={onResetApiToken}
          onChange={onApiTokenChange}
        />
      </InlineField>
    </div>
  );
}
