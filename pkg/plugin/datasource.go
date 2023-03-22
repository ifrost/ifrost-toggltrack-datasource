package plugin

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"io"
	"net/http"
	"strings"
	"time"
)

// Make sure Datasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler interfaces. Plugin should not implement all these
// interfaces- only those which are required for a particular task.
var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

var logger = log.New()

type TogglTrackHttpClient struct {
	client *http.Client
	url    string
	log    log.Logger
}

func newTogglTrackHttpClient(client *http.Client, url string, log log.Logger) *TogglTrackHttpClient {
	return &TogglTrackHttpClient{client: client, url: url, log: log}
}

func (c *TogglTrackHttpClient) makeRequest(ctx context.Context, method string, path string) (*http.Response, error) {
	request, err := http.NewRequestWithContext(ctx, method, c.url+path, nil)

	if err != nil {
		return nil, fmt.Errorf("new request with context: %w", err)
	}

	resp, err := c.client.Do(request)

	if err != nil {
		return nil, fmt.Errorf("e: %w", err)
	} else {
		return resp, nil
	}
}

// NewDatasource creates a new datasource instance.
func NewDatasource(instanceSettings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {

	if apiToken, exists := instanceSettings.DecryptedSecureJSONData["apiToken"]; exists {

		authToken := fmt.Sprintf("%s", apiToken)
		authHash := authToken + ":api_token"
		authHashB64 := base64.StdEncoding.EncodeToString([]byte(authHash))
		httpClient, err := httpclient.New(httpclient.Options{
			Headers: map[string]string{
				"Content-Type":  "application/json",
				"Authorization": "Basic " + authHashB64,
			},
		})
		if err != nil {
			return nil, fmt.Errorf("httpclient new: %w", err)
		} else {
			return &Datasource{
				TogglTrackHttpClient: newTogglTrackHttpClient(httpClient, "https://api.track.toggl.com/api/v9/", logger),
			}, nil
		}
	} else {
		return nil, fmt.Errorf("api key not configured")
	}

	return &Datasource{}, nil
}

// Datasource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type Datasource struct {
	TogglTrackHttpClient *TogglTrackHttpClient
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (d *Datasource) Dispose() {
	// Clean up datasource instance resources.
}

func (d *Datasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req.URL == "projects" {
		resp, err := d.TogglTrackHttpClient.makeRequest(ctx, http.MethodGet, "me/projects")

		if err != nil {
			sender.Send(&backend.CallResourceResponse{
				Status: 503,
			})
		}
		defer resp.Body.Close()
		var projects []TogglTrackProject
		body, _ := io.ReadAll(resp.Body)
		err = json.Unmarshal(body, &projects)
		if err != nil {
			sender.Send(&backend.CallResourceResponse{
				Status: 503,
			})
		}

		projectsJson, _ := json.Marshal(projects)
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   projectsJson,
		})
	} else if req.URL == "clients" {
		resp, err := d.TogglTrackHttpClient.makeRequest(ctx, http.MethodGet, "me/clients")

		if err != nil {
			sender.Send(&backend.CallResourceResponse{
				Status: 503,
			})
		}
		defer resp.Body.Close()
		var clients []TogglTrackClient
		body, _ := io.ReadAll(resp.Body)
		err = json.Unmarshal(body, &clients)
		if err != nil {
			sender.Send(&backend.CallResourceResponse{
				Status: 503,
			})
		}

		clientsJson, _ := json.Marshal(clients)
		return sender.Send(&backend.CallResourceResponse{
			Status: 200,
			Body:   clientsJson,
		})
	} else {
		return sender.Send(&backend.CallResourceResponse{
			Status: 404,
		})
	}
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// create response struct
	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		res := d.query(ctx, req.PluginContext, q, req)

		// save the response in a hashmap
		// based on with RefID as identifier
		response.Responses[q.RefID] = res
	}

	return response, nil
}

type queryModel struct {
	ProjectIds  []int64 `json:"projects"`
	Description string  `json:"description"`
}

type TogglTrackTimeEntry struct {
	Start       string `json:"start"`
	Stop        string `json:"stop,omitempty"`
	Duration    int64  `json:"duration"`
	ProjectId   int64  `json:"project_id"`
	Description string `json:"description"`
}

type TogglTrackProject struct {
	Id       int64  `json:"id"`
	Name     string `json:"name"`
	ClientId int64  `json:"client_id"`
}

type TogglTrackClient struct {
	Id   int64  `json:"id"`
	Name string `json:"name"`
}

func matchesQuery(qm queryModel, entry TogglTrackTimeEntry) bool {
	var containsProject bool

	if len(qm.ProjectIds) == 0 {
		containsProject = true
	} else {
		containsProject = false
		for _, project := range qm.ProjectIds {
			if project == entry.ProjectId {
				containsProject = true
			}
		}
	}

	var containsDescription = strings.Contains(entry.Description, qm.Description)

	return containsProject && containsDescription
}

func (d *Datasource) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery, req *backend.QueryDataRequest) backend.DataResponse {
	var response backend.DataResponse

	// Unmarshal the JSON into our queryModel.
	var qm queryModel

	err := json.Unmarshal(query.JSON, &qm)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
	}

	////////////
	startDate := query.TimeRange.From.Format("2006-01-02T15:04:05Z")
	endDate := query.TimeRange.To.Format("2006-01-02T15:04:05Z")
	resp, err := d.TogglTrackHttpClient.makeRequest(ctx, http.MethodGet, "me/time_entries?start_date="+startDate+"&end_date="+endDate)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("request error: %v", err.Error()))
	}

	defer resp.Body.Close()
	var respJson []TogglTrackTimeEntry
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("query failed: %v", string(body)))
	}

	err = json.Unmarshal(body, &respJson)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("failed to parse response: %v", err.Error()))
	}
	////////////

	// create data frame response.
	// For an overview on data frames and how grafana handles them:
	// https://grafana.com/docs/grafana/latest/developers/plugins/data-frames/
	frame := data.NewFrame("response")

	// add fields.

	frame.Fields = append(frame.Fields,
		data.NewField("time", nil, []time.Time{}),
		data.NewField("start", nil, []string{}),
		data.NewField("end", nil, []string{}),
		data.NewField("duration", nil, []int64{}),
		data.NewField("project_id", nil, []int64{}),
		data.NewField("description", nil, []string{}),
	)

	for _, entry := range respJson {
		time, _ := time.Parse("2006-01-02T15:04:05-07:00", entry.Start)
		if entry.Stop != "" && matchesQuery(qm, entry) {
			frame.AppendRow(time, entry.Stop, entry.Stop, entry.Duration, entry.ProjectId, entry.Description)
		}
	}

	// add the frames to the response.
	response.Frames = append(response.Frames, frame)

	return response
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(ctx context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {

	resp, err := d.TogglTrackHttpClient.makeRequest(ctx, http.MethodGet, "me")
	if err != nil {
		return nil, fmt.Errorf("cannot make request to API: %w", err)
	}

	if resp.StatusCode == 200 {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusOk,
			Message: "Data source configured properly",
		}, nil
	} else if resp.StatusCode == 403 {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Incorrect API token",
		}, nil
	} else {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "API authorization failed. HTTP status code = " + resp.Status,
		}, nil
	}
}
