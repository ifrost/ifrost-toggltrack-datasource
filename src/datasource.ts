import {
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  MutableDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { DEFAULT_QUERY, QueryMode, TogglTrackDataSourceOptions, TogglTrackProject, TogglTrackQuery } from './types';
import { from, lastValueFrom, Observable } from 'rxjs';
import { groupBy } from 'lodash';
import { enrichRawResults, processToEntriesList, processToTotals } from './utils';

export class DataSource extends DataSourceWithBackend<TogglTrackQuery, TogglTrackDataSourceOptions> {
  private cachedProjectsPromise?: Promise<TogglTrackProject[]>;

  constructor(instanceSettings: DataSourceInstanceSettings<TogglTrackDataSourceOptions>) {
    super(instanceSettings);
  }

  getDefaultQuery(_: CoreApp): Partial<TogglTrackQuery> {
    return DEFAULT_QUERY;
  }

  query(request: DataQueryRequest<TogglTrackQuery>): Observable<DataQueryResponse> {
    const responsePromise = lastValueFrom(super.query(request));
    const projectsPromise = this.getProjects();

    const queryByMode = groupBy(request.targets, 'mode');
    let refIdsByMode: Record<string, string[]> = {};
    Object.keys(queryByMode).forEach((mode) => {
      refIdsByMode[mode] = queryByMode[mode].map((query: TogglTrackQuery) => query.refId);
    });

    return from(
      Promise.all([responsePromise, projectsPromise]).then(
        ([response, projects]: [DataQueryResponse, TogglTrackProject[]]) => {
          const rawDataFrames = enrichRawResults(response.data, projects);
          let processedDataFrames: MutableDataFrame[] = [];
          let filteredFrames: MutableDataFrame[] = [];

          const filterByMode = (
            mode: QueryMode,
            handler: (filteredDataFrames: MutableDataFrame[]) => MutableDataFrame[]
          ) => {
            if (!refIdsByMode[mode]) {
              return;
            }
            filteredFrames = rawDataFrames.filter((dataFrame) => refIdsByMode[mode].includes(dataFrame.refId || ''));
            processedDataFrames = [...processedDataFrames, ...handler(filteredFrames)];
          };

          filterByMode('entries', (filteredDataFrames) => processToEntriesList(filteredDataFrames));
          filterByMode('totals', (filteredDataFrames) =>
            processToTotals(filteredDataFrames, request.range.from, request.range.to)
          );

          response.data = processedDataFrames;

          return response;
        }
      )
    );
  }

  async getProjects(): Promise<TogglTrackProject[]> {
    if (!this.cachedProjectsPromise) {
      this.cachedProjectsPromise = this.getResource('projects');
    }
    return this.cachedProjectsPromise;
  }
}
