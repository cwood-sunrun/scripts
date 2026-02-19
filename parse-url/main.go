package main

import (
	"fmt"
	"net/url"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: url-parse <url>")
		os.Exit(1)
	}

	rawUrl := os.Args[1]

	parsedURL, err := url.Parse(rawUrl)

	if err != nil {
		fmt.Println(os.Stderr, "Error parsing url")
		os.Exit(1)
	}

	fmt.Println("host ", parsedURL.Host)
	fmt.Println("path ", parsedURL.Path)
	fmt.Println("query ", parsedURL.RawQuery)
	fmt.Println("fragment ", parsedURL.Fragment)
}
