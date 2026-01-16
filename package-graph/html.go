package main

import "encoding/json"

func generateHTML(graphData GraphData, projectName string) string {
	graphJSON, _ := json.Marshal(graphData)

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Package Dependency Graph - ` + projectName + `</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            overflow: hidden;
        }
        #container {
            width: 100vw;
            height: 100vh;
            position: relative;
        }
        svg {
            width: 100%;
            height: 100%;
        }
        .node circle {
            stroke: #fff;
            stroke-width: 2px;
            cursor: pointer;
            transition: stroke-width 0.2s, opacity 0.3s;
        }
        .node circle:hover {
            stroke-width: 4px;
        }
        .node text {
            font-size: 11px;
            fill: #e0e0e0;
            pointer-events: none;
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
            transition: opacity 0.3s;
        }
        .link {
            stroke: #4a5568;
            stroke-opacity: 0.6;
            transition: opacity 0.3s;
        }
        .legend {
            position: absolute;
            top: 20px;
            left: 20px;
            background: rgba(26, 26, 46, 0.9);
            padding: 15px 20px;
            border-radius: 10px;
            color: #e0e0e0;
            font-size: 14px;
            border: 1px solid #4a5568;
        }
        .legend h3 {
            margin-bottom: 10px;
            color: #fff;
        }
        .legend-item {
            display: flex;
            align-items: center;
            margin: 8px 0;
        }
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            margin-right: 10px;
            border: 2px solid #fff;
        }
        .legend-item input[type="checkbox"] {
            width: 16px;
            height: 16px;
            margin-right: 10px;
            cursor: pointer;
            accent-color: #3498db;
        }
        .legend-item label {
            display: flex;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }
        .legend-item.disabled .legend-color {
            opacity: 0.3;
        }
        .legend-item.disabled span {
            opacity: 0.5;
            text-decoration: line-through;
        }
        .tooltip {
            position: absolute;
            background: rgba(26, 26, 46, 0.95);
            color: #fff;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            border: 1px solid #4a5568;
        }
    </style>
</head>
<body>
    <div id="container">
        <svg></svg>
        <div class="legend">
            <h3>` + projectName + `</h3>
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
        <div class="tooltip" id="tooltip"></div>
    </div>
    <script>
        // Graph group constants
        const GROUP_ROOT = 0;
        const GROUP_PROD = 1;
        const GROUP_DEV = 2;
        const GROUP_TRANSITIVE = 3;

        const data = ` + string(graphJSON) + `;

        const container = document.getElementById('container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        const colorScale = d3.scaleOrdinal()
            .domain([GROUP_ROOT, GROUP_PROD, GROUP_DEV, GROUP_TRANSITIVE])
            .range(['#e74c3c', '#3498db', '#9b59b6', '#2ecc71']);

        const svg = d3.select('svg')
            .attr('viewBox', [0, 0, width, height]);

        const g = svg.append('g');

        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        const simulation = d3.forceSimulation(data.nodes)
            .force('link', d3.forceLink(data.links).id(d => d.id).distance(80))
            .force('charge', d3.forceManyBody().strength(-200))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => d.size + 10));

        const link = g.append('g')
            .selectAll('line')
            .data(data.links)
            .join('line')
            .attr('class', 'link')
            .attr('stroke-width', 1.5);

        const node = g.append('g')
            .selectAll('.node')
            .data(data.nodes)
            .join('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        node.append('circle')
            .attr('r', d => d.size)
            .attr('fill', d => colorScale(d.group));

        node.append('text')
            .attr('dx', d => d.size + 5)
            .attr('dy', 4)
            .text(d => d.id);

        const tooltip = d3.select('#tooltip');

        // Track selected node for path filtering
        let selectedNodeId = null;

        // Find root node id
        const rootNodeId = data.nodes.find(n => n.group === GROUP_ROOT)?.id;

        // Find all nodes reachable from a given node without crossing root
        function findReachableWithoutRoot(startId) {
            const reachable = new Set([startId]);
            const queue = [startId];
            
            while (queue.length > 0) {
                const currentId = queue.shift();
                const neighbors = adjacencyMap.get(currentId) || [];
                
                for (const neighbor of neighbors) {
                    // Skip root node - don't traverse through it
                    if (neighbor.id === rootNodeId) continue;
                    
                    if (!reachable.has(neighbor.id)) {
                        reachable.add(neighbor.id);
                        queue.push(neighbor.id);
                    }
                }
            }
            
            return reachable;
        }

        function updateDimming() {
            if (selectedNodeId === null) {
                // Clear all dimming
                node.select('circle').style('opacity', 1);
                node.select('text').style('opacity', 1);
                link.style('opacity', 1);
            } else {
                const reachable = findReachableWithoutRoot(selectedNodeId);
                
                // Dim nodes not reachable without crossing root
                node.select('circle').style('opacity', d => reachable.has(d.id) ? 1 : 0.15);
                node.select('text').style('opacity', d => reachable.has(d.id) ? 1 : 0.15);
                
                // Dim links where either endpoint is dimmed
                link.style('opacity', d => {
                    const sourceReachable = reachable.has(d.source.id);
                    const targetReachable = reachable.has(d.target.id);
                    return (sourceReachable && targetReachable) ? 1 : 0.1;
                });
            }
        }

        node.on('click', (event, d) => {
            event.stopPropagation();
            
            if (selectedNodeId === d.id) {
                // Clicking same node clears selection
                selectedNodeId = null;
            } else {
                selectedNodeId = d.id;
            }
            
            updateDimming();
        });

        // Click on background to clear selection
        svg.on('click', () => {
            if (selectedNodeId !== null) {
                selectedNodeId = null;
                updateDimming();
            }
        });

        node.on('mouseover', (event, d) => {
            const connections = data.links.filter(l => 
                l.source.id === d.id || l.target.id === d.id
            ).length;
            tooltip
                .style('opacity', 1)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .html(d.id + '<br>Connections: ' + connections);
        })
        .on('mouseout', () => {
            tooltip.style('opacity', 0);
        });

        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
        });

        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        // Filter functionality
        const visibleGroups = new Set([GROUP_ROOT, GROUP_PROD, GROUP_DEV, GROUP_TRANSITIVE]);

        // Build adjacency map for quick lookups
        const adjacencyMap = new Map();
        data.nodes.forEach(n => adjacencyMap.set(n.id, []));
        data.links.forEach(l => {
            adjacencyMap.get(l.source.id).push(l.target);
            adjacencyMap.get(l.target.id).push(l.source);
        });

        function computeVisibleNodes() {
            // Start with nodes whose group is checked
            const visibleNodes = new Set();
            const nodeById = new Map(data.nodes.map(n => [n.id, n]));
            
            // Root node (group 0) is always visible if its checkbox is checked
            data.nodes.forEach(n => {
                if (visibleGroups.has(n.group)) {
                    visibleNodes.add(n.id);
                }
            });

            // Iteratively remove nodes that have no visible connections
            // (except root which stays visible if checked)
            let changed = true;
            while (changed) {
                changed = false;
                visibleNodes.forEach(nodeId => {
                    const nodeData = nodeById.get(nodeId);
                    // Root node stays visible
                    if (nodeData.group === GROUP_ROOT) return;
                    
                    // Check if this node has any visible neighbors
                    const neighbors = adjacencyMap.get(nodeId);
                    const hasVisibleNeighbor = neighbors.some(neighbor => 
                        visibleNodes.has(neighbor.id)
                    );
                    
                    if (!hasVisibleNeighbor) {
                        visibleNodes.delete(nodeId);
                        changed = true;
                    }
                });
            }

            return visibleNodes;
        }

        function updateVisibility() {
            const visibleNodes = computeVisibleNodes();

            // Update node visibility
            node.style('display', d => visibleNodes.has(d.id) ? null : 'none');

            // Update link visibility - hide if either endpoint is hidden
            link.style('display', d => {
                return visibleNodes.has(d.source.id) && visibleNodes.has(d.target.id) ? null : 'none';
            });

            // Reheat simulation slightly for better layout
            simulation.alpha(0.3).restart();
        }

        // Add event listeners to checkboxes
        document.querySelectorAll('.legend-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const group = parseInt(e.target.dataset.group);
                const legendItem = e.target.closest('.legend-item');
                
                if (e.target.checked) {
                    visibleGroups.add(group);
                    legendItem.classList.remove('disabled');
                } else {
                    visibleGroups.delete(group);
                    legendItem.classList.add('disabled');
                }
                
                updateVisibility();
            });
        });
    </script>
</body>
</html>`
}
