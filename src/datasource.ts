import {
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  MutableDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';

import {
  DEFAULT_QUERY,
  ToggleTrackClient,
  ToggleTrackClientDTO,
  ToggleTrackProjectDTO,
  TogglTrackDataSourceOptions,
  TogglTrackProject,
  TogglTrackQuery,
} from './types';
import { from, lastValueFrom, Observable } from 'rxjs';
import { enrichRawResults, processToEntriesList, processToTotals } from './utils';
import { groupBy } from 'lodash';

export class DataSource extends DataSourceWithBackend<TogglTrackQuery, TogglTrackDataSourceOptions> {
  private cachedProjectsPromise?: Promise<TogglTrackProject[]>;
  private cachedClientsPromise?: Promise<ToggleTrackClient[]>;

  constructor(instanceSettings: DataSourceInstanceSettings<TogglTrackDataSourceOptions>) {
    super(instanceSettings);
  }

  getDefaultQuery(_: CoreApp): Partial<TogglTrackQuery> {
    return DEFAULT_QUERY;
  }

  query(request: DataQueryRequest<TogglTrackQuery>): Observable<DataQueryResponse> {
    const responsePromise = lastValueFrom(super.query(request));
    const projectsPromise = this.getProjects();
    const clientsPromise = this.getClients();

    return from(
      Promise.all([responsePromise, projectsPromise, clientsPromise]).then(
        ([response, projects, clients]: [DataQueryResponse, TogglTrackProject[], ToggleTrackClient[]]) => {
          const rawDataFrames = enrichRawResults(response.data, projects, clients);
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
      this.cachedProjectsPromise = Promise.all([this.getResource('projects'), this.getClients()]).then(
        ([projects, clients]: [ToggleTrackProjectDTO[], ToggleTrackClient[]]) => {
          return projects.map((project): TogglTrackProject => {
            const clientsById = groupBy(clients, 'id');
            return {
              id: project.id,
              clientId: project.client_id,
              clientName: clientsById[project.client_id]?.[0]?.name || 'unknown',
              name: project.name,
            };
          });
        }
      );
    }
    return this.cachedProjectsPromise;
  }

  async getClients(): Promise<ToggleTrackClient[]> {
    if (!this.cachedClientsPromise) {
      this.cachedClientsPromise = this.getResource('clients').then((clients: ToggleTrackClientDTO[]) => {
        return clients.map((client) => {
          return {
            id: client.id,
            name: client.name,
          };
        });
      });
    }
    return this.cachedClientsPromise;
  }
}
