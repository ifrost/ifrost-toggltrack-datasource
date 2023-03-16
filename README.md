# Info

This is a [Toggl Track](https://track.toggl.com/) plugin for Grafana

## Setup

All you need is API token. You can find it on your [profile](https://track.toggl.com/profile) page. Scroll to the bottom, click to reveal and copy the token.

![Toggl Track API Token](./src/img/toggl-api-token.png)

Add the token in Toggl Track data source settings

## Query

By default, the editor loads all time entries.

![Toggl Track Query Editor](./src/img/editor.png)

### Filtering

Narrow down the results by providing:

* "Projects" - show only time entries from selected projects
* "Description" - show only time entries containing provided description

### Aggregations

Aggregate time entries changing the mode:

![Toggl Track Query Editor modes](./src/img/modes.png)

#### Build a dashboard

[Example](./src/data/dashboard.json)

![Toggl Track Query Editor modes](./src/img/dashboard.png)
