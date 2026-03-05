package main

import (
	_ "embed"
	"bytes"
	"encoding/json"
	"text/template"
)

//go:embed assets/style.css
var cssContent string

//go:embed assets/graph.js
var jsContent string

var htmlTemplate = template.Must(template.New("page").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Package Dependency Graph - {{.ProjectName}}</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
{{.CSS}}
    </style>
</head>
<body>
    <div id="container">
        <svg></svg>
        <div class="legend">
            <h3>{{.ProjectName}}</h3>
            <div class="legend-item" data-group="0">
                <label>
                    <input type="checkbox" checked data-group="0">
                    <div class="legend-color" style="background: #e74c3c;"></div>
                    <span>Root Package</span>
                </label>
            </div>
            <div class="legend-item" data-group="1">
                <label>
                    <input type="checkbox" checked data-group="1">
                    <div class="legend-color" style="background: #3498db;"></div>
                    <span>Production Dependency</span>
                </label>
            </div>
            <div class="legend-item" data-group="2">
                <label>
                    <input type="checkbox" checked data-group="2">
                    <div class="legend-color" style="background: #9b59b6;"></div>
                    <span>Dev Dependency</span>
                </label>
            </div>
            <div class="legend-item" data-group="3">
                <label>
                    <input type="checkbox" checked data-group="3">
                    <div class="legend-color" style="background: #2ecc71;"></div>
                    <span>Transitive Dependency</span>
                </label>
            </div>
        </div>
        <div class="search-box">
            <input type="text" id="searchInput" placeholder="Search packages..." />
            <div class="search-results" id="searchResults"></div>
        </div>
        <div class="node-info" id="nodeInfo"></div>
        <div class="tooltip" id="tooltip"></div>
    </div>
    <script>const data = {{.GraphData}};</script>
    <script>
{{.JS}}
    </script>
</body>
</html>`))

func generateHTML(graphData GraphData, projectName string) string {
	graphJSON, _ := json.Marshal(graphData)

	var buf bytes.Buffer
	htmlTemplate.Execute(&buf, map[string]string{
		"ProjectName": projectName,
		"CSS":         cssContent,
		"JS":          jsContent,
		"GraphData":   string(graphJSON),
	})
	return buf.String()
}
