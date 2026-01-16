package main

const (
	GroupRoot       = 0
	GroupProd       = 1
	GroupDev        = 2
	GroupTransitive = 3
)

type GraphNode struct {
	ID    string `json:"id"`
	Group int    `json:"group"`
	Size  int    `json:"size"`
}

type GraphLink struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Links []GraphLink `json:"links"`
}
