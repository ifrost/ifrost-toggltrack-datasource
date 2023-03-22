import { DataQuery, DataSourceJsonData, DurationUnit } from '@grafana/data';

export interface TogglTrackQueryAggregation {
  amount: number;
  unit: DurationUnit;
}

export interface TogglTrackQuery extends DataQuery {
  projects: number[];
  description: string;
  aggregate?: TogglTrackQueryAggregation;
}

export const DEFAULT_QUERY: Partial<TogglTrackQuery> = {
  projects: [],
  description: '',
  aggregate: undefined,
};

export interface TogglTrackDataSourceOptions extends DataSourceJsonData {}

export interface ToggleTrackSecureJsonData {
  apiToken?: string;
}

/**
 * DTOs coming from backend
 */
export type ToggleTrackProjectDTO = {
  id: number;
  name: string;
  client_id: number;
};

export type ToggleTrackClientDTO = {
  id: number;
  name: string;
};

/**
 * Projects returned from /projects resource
 */
export type TogglTrackProject = {
  id: number;
  name: string;
  clientName: string;
  clientId: number;
};

export type ToggleTrackClient = {
  id: number;
  name: string;
};

/**
 * Single time entry
 */
export type TogglTrackEntry = {
  time: number;
  start: string;
  end: string;
  description: string;
  duration: number;
  duration_hours: number;
  duration_minutes: number;
  formatted_duration: string;
  project_id: number;
  project_name: string;
  client_id: number;
  client_name: string;
};
