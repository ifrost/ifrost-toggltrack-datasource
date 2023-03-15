import { DataFrame, dateTime, DateTime, DurationUnit, FieldType, MutableDataFrame, toUtc } from '@grafana/data';
import { TogglTrackEntry, TogglTrackProject } from './types';
import { groupBy } from 'lodash';

/**
 * Replace project_id with project name and add helper properties for duration
 */
export function enrichRawResults(dataFrames: DataFrame[], projects: TogglTrackProject[]): MutableDataFrame[] {
  return dataFrames.map((source: DataFrame) => {
    const projectsById = groupBy(projects, 'Id');
    const dataFrame = new MutableDataFrame(source);
    dataFrame.addField({ name: 'project_name', type: FieldType.string });
    dataFrame.addField({ name: 'formatted_duration', type: FieldType.string });
    dataFrame.addField({ name: 'duration_hours', type: FieldType.number });
    dataFrame.addField({ name: 'duration_minutes', type: FieldType.number });
    for (let i = 0; i < dataFrame.length; i++) {
      const entry = dataFrame.get(i);
      dataFrame.set(i, {
        ...entry,
        project_name: projectsById[entry.project_id]?.[0]?.Name || 'unknown',
        formatted_duration: toUtc(entry.duration * 1000).format('HH:mm'),
        duration_hours: entry.duration / 60 / 60,
        duration_minutes: entry.duration / 60,
      });
    }
    return dataFrame;
  });
}

/**
 * Aggregate data
 */
export function processToTotals(
  rawDataFrames: MutableDataFrame[],
  from: DateTime,
  to: DateTime,
  aggAmount = 1,
  aggUnit: DurationUnit = 'day'
): MutableDataFrame[] {
  const entriesByProject: Record<string, TogglTrackEntry[]> = {};
  rawDataFrames.forEach((rawDataFrame) => {
    for (let i = 0; i < rawDataFrame.length; i++) {
      const entry: TogglTrackEntry = rawDataFrame.get(i);
      entriesByProject[entry.project_name] = entriesByProject[entry.project_name] || [];
      entriesByProject[entry.project_name].push(entry);
    }
  });

  const buckets: DateTime[] = [];
  let newBucket = dateTime(from).endOf(aggUnit);
  while (newBucket.toDate().getTime() < to.toDate().getTime()) {
    buckets.push(newBucket);
    newBucket = dateTime(newBucket).add(aggAmount, aggUnit);
  }
  buckets.push(dateTime(to));

  const frame = new MutableDataFrame();
  frame.addField({ name: '__time', type: FieldType.time, values: buckets });

  Object.keys(entriesByProject).forEach((projectName) => {
    const values = buckets.map((endTime, index) => {
      const entries = entriesByProject[projectName].filter((entry) => {
        const start = index === 0 ? null : buckets[index - 1].toDate().getTime();
        const end = buckets[index].toDate().getTime();
        return (!start || start <= entry.time) && entry.time < end;
      });
      const total = entries.reduce((prev, next) => prev + next.duration_hours, 0);
      return total || undefined;
    });

    frame.addField({ name: projectName, type: FieldType.number, values });
  });

  return [frame];
}

/**
 * Simple list of time entries
 */
export function processToEntriesList(rawDataFrames: MutableDataFrame[]): MutableDataFrame[] {
  return rawDataFrames.map((rawDataFrame) => {
    const tableDataFrame = new MutableDataFrame();
    tableDataFrame.addField({ name: 'start', type: FieldType.time });
    tableDataFrame.addField({ name: 'end', type: FieldType.time });
    tableDataFrame.addField({ name: 'project', type: FieldType.string });
    tableDataFrame.addField({ name: 'description', type: FieldType.string });
    tableDataFrame.addField({ name: 'duration', type: FieldType.string });
    tableDataFrame.addField({ name: 'duration_hours', type: FieldType.number });
    for (let i = 0; i < rawDataFrame.length; i++) {
      const raw = rawDataFrame.get(i);
      tableDataFrame.set(i, {
        start: raw.time,
        end: raw.time,
        project: raw.project_name,
        description: raw.description,
        duration: raw.formatted_duration,
        duration_hours: raw.duration_hours,
      });
    }
    return tableDataFrame;
  });
}
