import React, { ChangeEvent, useEffect, useState } from 'react';
import { InlineField, Input, MultiSelect, Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from '../datasource';
import { TogglTrackDataSourceOptions, TogglTrackQuery, QUERY_MODES, QueryMode } from '../types';

type Props = QueryEditorProps<DataSource, TogglTrackQuery, TogglTrackDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  const onDescriptionChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, description: event.target.value });
  };

  const onProjectsChange = (projects: Array<SelectableValue<number>>) => {
    onChange({ ...query, projects: projects.map((app) => app.value || 0) });
    onRunQuery();
  };

  const onTypeChanged = (mode: SelectableValue<QueryMode>) => {
    onChange({ ...query, mode: mode.value || QUERY_MODES[0] });
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

  const { description, projects, mode } = query;

  const queryModes = QUERY_MODES.map((mode) => {
    return {
      label: mode,
      value: mode,
    };
  });

  return (
    <div className="gf-form">
      <InlineField label="Projects">
        <MultiSelect width={30} options={allProjects} value={projects || []} onChange={onProjectsChange} />
      </InlineField>
      <InlineField label="Description" labelWidth={16} tooltip="Filter entries containing specified description">
        <Input onChange={onDescriptionChange} onBlur={onRunQuery} value={description || ''} />
      </InlineField>
      <InlineField label="Mode">
        <Select onChange={onTypeChanged} options={queryModes} value={{ label: mode, value: mode }} />
      </InlineField>
    </div>
  );
}
