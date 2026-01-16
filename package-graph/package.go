package main

import "encoding/json"

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
