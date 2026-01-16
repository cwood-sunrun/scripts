package main

import (
	"encoding/json"
	"fmt"
	"os"
)

func countTransitiveDeps(packageName string, packageLock PackageLock) int {
	visited := make(map[string]bool)
	queue := []string{packageName}
	count := 0

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		if visited[current] {
			continue
		}
		visited[current] = true

		pkgPath := "node_modules/" + current
		pkg, exists := packageLock.Packages[pkgPath]
		if !exists {
			continue
		}

		for depName := range pkg.Dependencies {
			if !visited[depName] {
				count++
				queue = append(queue, depName)
			}
		}
	}

	return count
}

func buildGraph(packageLock PackageLock) GraphData {
	var nodes []GraphNode
	var links []GraphLink
	nodeSet := make(map[string]bool)

	root := packageLock.Packages[""]
	if root == nil {
		return GraphData{}
	}

	rootName := packageLock.Name
	if rootName == "" {
		rootName = "root"
	}

	// Add root node
	nodes = append(nodes, GraphNode{ID: rootName, Group: GroupRoot, Size: 20})
	nodeSet[rootName] = true

	// Collect top-level dependencies
	topLevelDeps := make(map[string]bool)
	for depName := range root.Dependencies {
		topLevelDeps[depName] = false // false = prod dependency
	}
	for depName := range root.DevDependencies {
		topLevelDeps[depName] = true // true = dev dependency
	}

	// Add top-level dependency nodes and links to root
	for depName, isDev := range topLevelDeps {
		group := GroupProd
		if isDev {
			group = GroupDev
		}
		size := countTransitiveDeps(depName, packageLock) + 5
		// Clamp maximum size
		if size > 30 {
			size = 30
		}

		if !nodeSet[depName] {
			nodes = append(nodes, GraphNode{ID: depName, Group: group, Size: size})
			nodeSet[depName] = true
		}
		links = append(links, GraphLink{Source: rootName, Target: depName})

		// Add transitive dependencies
		pkgPath := "node_modules/" + depName
		pkg, exists := packageLock.Packages[pkgPath]
		if exists {
			for transDepName := range pkg.Dependencies {
				if !nodeSet[transDepName] {
					nodes = append(nodes, GraphNode{ID: transDepName, Group: GroupTransitive, Size: 5})
					nodeSet[transDepName] = true
				}
				links = append(links, GraphLink{Source: depName, Target: transDepName})
			}
		}
	}

	return GraphData{Nodes: nodes, Links: links}
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: package-graph <path-to-package-lock.json> [output.html]")
		os.Exit(1)
	}

	filePath := os.Args[1]
	outputPath := "package-graph.html"
	if len(os.Args) >= 3 {
		outputPath = os.Args[2]
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err)
		os.Exit(1)
	}

	var packageLock PackageLock
	if err := json.Unmarshal(data, &packageLock); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing JSON: %v\n", err)
		os.Exit(1)
	}

	root := packageLock.Packages[""]
	if root == nil {
		fmt.Fprintln(os.Stderr, "No root package found")
		os.Exit(1)
	}

	graphData := buildGraph(packageLock)

	projectName := packageLock.Name
	if projectName == "" {
		projectName = "Package Graph"
	}

	html := generateHTML(graphData, projectName)

	if err := os.WriteFile(outputPath, []byte(html), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing HTML file: %v\n", err)
		os.Exit(1)
	}

	// Print summary
	var prodCount, devCount, transitiveCount int
	for _, node := range graphData.Nodes {
		switch node.Group {
		case GroupProd:
			prodCount++
		case GroupDev:
			devCount++
		case GroupTransitive:
			transitiveCount++
		}
	}

	fmt.Printf("Generated %s\n", outputPath)
	fmt.Printf("  Root: %s\n", projectName)
	fmt.Printf("  Production deps: %d\n", prodCount)
	fmt.Printf("  Dev deps: %d\n", devCount)
	fmt.Printf("  Transitive deps: %d\n", transitiveCount)
	fmt.Printf("  Total nodes: %d\n", len(graphData.Nodes))
	fmt.Printf("  Total links: %d\n", len(graphData.Links))
}
