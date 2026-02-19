package main

type PackageInfo struct {
	Version         string            `json:"version,omitempty"`
	Resolved        string            `json:"resolved,omitempty"`
	Integrity       string            `json:"integrity,omitempty"`
	Dev             bool              `json:"dev,omitempty"`
	Optional        bool              `json:"optional,omitempty"`
	Dependencies    map[string]string `json:"dependencies,omitempty"`
	DevDependencies map[string]string `json:"devDependencies,omitempty"`
}

type PackageLock struct {
	Name            string                  `json:"name"`
	Version         string                  `json:"version"`
	LockfileVersion int                     `json:"lockfileVersion"`
	Requires        bool                    `json:"requires,omitempty"`
	Packages        map[string]*PackageInfo `json:"packages"`
}
