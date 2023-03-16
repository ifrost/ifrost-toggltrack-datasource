import {
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  MutableDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import { DEFAULT_QUERY, TogglTrackDataSourceOptions, TogglTrackProject, TogglTrackQuery } from './types';
import { from, lastValueFrom, Observable } from 'rxjs';
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

    return from(
      Promise.all([responsePromise, projectsPromise]).then(
        ([response, projects]: [DataQueryResponse, TogglTrackProject[]]) => {
          const rawDataFrames = enrichRawResults(response.data, projects);
          let processedDataFrames: MutableDataFrame[] = [];

          request.targets.forEach((query) => {
            const filteredDataFrames = rawDataFrames.filter((dataFrame) => query.refId === dataFrame.refId);
            const newDataFrames = query.aggregate
              ? processToTotals(
                  filteredDataFrames,
                  request.range.from,
                  request.range.to,
                  query.aggregate.amount,
                  query.aggregate.unit
                )
              : processToEntriesList(filteredDataFrames);
            processedDataFrames = [...processedDataFrames, ...newDataFrames];
          });

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
