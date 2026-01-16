package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type PackageInfo struct {
	Version         string            `json:"version,omitempty"`
	Resolved        string            `json:"resolved,omitempty"`
	Integrity       string            `json:"integrity,omitempty"`
	Dev             bool              `json:"dev,omitempty"`
	Optional        bool              `json:"optional,omitempty"`
	Dependencies    map[string]string `json:"dependencies,omitempty"`
	DevDependencies map[string]string `json:"devDependencies,omitempty"`
	Engines         map[string]string `json:"engines,omitempty"`
	Funding         json.RawMessage   `json:"funding,omitempty"`
	License         string            `json:"license,omitempty"`
}

type PackageLock struct {
	Name            string                  `json:"name"`
	Version         string                  `json:"version"`
	LockfileVersion int                     `json:"lockfileVersion"`
	Requires        bool                    `json:"requires,omitempty"`
	Packages        map[string]*PackageInfo `json:"packages"`
}

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

		// Look up the package in the packages map
		// Packages are stored as "node_modules/<name>" 
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


func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: dep-graph <path-to-json-file>")
		os.Exit(1)
	}

	filePath := os.Args[1]

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

	// Get the root package (empty string key)
	root := packageLock.Packages[""]
	if root == nil {
		fmt.Fprintln(os.Stderr, "No root package found")
		os.Exit(1)
	}

	// Collect all top-level dependencies (prod and dep)
	topLevelDeps := make([]string, 0)
	for depName := range root.Dependencies {
		topLevelDeps = append(topLevelDeps, depName)
	}
	for depName := range root.DevDependencies {
		topLevelDeps = append(topLevelDeps, depName)
	}

	for _, depName := range topLevelDeps {
		count := countTransitiveDeps(depName, packageLock)
		fmt.Printf("%s, %d\n", depName, count)
	}
}
