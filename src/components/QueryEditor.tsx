import React, { ChangeEvent, useEffect, useState } from 'react';
import { InlineField, Input, MultiSelect, Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from '../datasource';
import { TogglTrackDataSourceOptions, TogglTrackQuery, TogglTrackQueryAggregation } from '../types';
import { find, isEqual } from 'lodash';

type Props = QueryEditorProps<DataSource, TogglTrackQuery, TogglTrackDataSourceOptions>;

const QUERY_MODES: Array<SelectableValue<TogglTrackQueryAggregation>> = [
  { label: 'All', value: undefined },
  { label: 'Daily', value: { amount: 1, unit: 'day' } },
  { label: 'Weekly', value: { amount: 1, unit: 'week' } },
  { label: 'Monthly', value: { amount: 1, unit: 'month' } },
];

const findSelectedMode = (aggregate?: TogglTrackQueryAggregation): SelectableValue<TogglTrackQueryAggregation> => {
  const mode = find<SelectableValue<TogglTrackQueryAggregation>>(QUERY_MODES, (option) =>
    isEqual(aggregate, option.value)
  );
  return mode || { label: 'Custom', value: aggregate };
};

export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  const onDescriptionChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, description: event.target.value });
  };

  const onProjectsChange = (projects: Array<SelectableValue<number>>) => {
    onChange({ ...query, projects: projects.map((app) => app.value || 0) });
    onRunQuery();
  };

  const onTypeChanged = (mode: SelectableValue<TogglTrackQueryAggregation>) => {
    onChange({ ...query, aggregate: mode.value });
    onRunQuery();
  };

  const [allProjects, setAllProjects] = useState<Array<SelectableValue<number>>>([]);

  useEffect(() => {
    const run = async () => {
      const projects = await datasource.getProjects();
      const selectableProjects = projects.map(({ Id, Name }) => {
        return {
          label: Name,
          value: Id,
        };
      });
      setAllProjects(selectableProjects);
    };
    run();
  }, [datasource]);

  const { description, projects, aggregate } = query;
  const selectedMode = findSelectedMode(aggregate);

  return (
    <div className="gf-form">
      <InlineField label="Projects">
        <MultiSelect width={30} options={allProjects} value={projects || []} onChange={onProjectsChange} />
      </InlineField>
      <InlineField label="Description" labelWidth={16} tooltip="Include entries containing specified description">
        <Input onChange={onDescriptionChange} onBlur={onRunQuery} value={description || ''} />
      </InlineField>
      <InlineField label="Mode">
        <Select onChange={onTypeChanged} options={QUERY_MODES} value={selectedMode} />
      </InlineField>
    </div>
  );
}
