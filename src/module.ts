import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { TogglTrackQuery, TogglTrackDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, TogglTrackQuery, TogglTrackDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
