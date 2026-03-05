const GROUP_ROOT = 0;
const GROUP_PROD = 1;
const GROUP_DEV = 2;
const GROUP_TRANSITIVE = 3;

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

let selectedNodeId = null;

const rootNodeId = data.nodes.find(n => n.group === GROUP_ROOT)?.id;

function findReachableWithoutRoot(startId) {
    const reachable = new Set([startId]);
    const queue = [startId];

    while (queue.length > 0) {
        const currentId = queue.shift();
        const neighbors = adjacencyMap.get(currentId) || [];

        for (const neighbor of neighbors) {
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
        node.select('circle').style('opacity', 1);
        node.select('text').style('opacity', 1);
        link.style('opacity', 1);
    } else {
        const reachable = findReachableWithoutRoot(selectedNodeId);

        node.select('circle').style('opacity', d => reachable.has(d.id) ? 1 : 0.15);
        node.select('text').style('opacity', d => reachable.has(d.id) ? 1 : 0.15);

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
        selectedNodeId = null;
        hideNodeInfo();
    } else {
        selectedNodeId = d.id;
        showNodeInfo(d);
    }

    updateDimming();
});

svg.on('click', () => {
    if (selectedNodeId !== null) {
        selectedNodeId = null;
        updateDimming();
        hideNodeInfo();
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

const visibleGroups = new Set([GROUP_ROOT, GROUP_PROD, GROUP_DEV, GROUP_TRANSITIVE]);

const adjacencyMap = new Map();
data.nodes.forEach(n => adjacencyMap.set(n.id, []));
data.links.forEach(l => {
    adjacencyMap.get(l.source.id).push(l.target);
    adjacencyMap.get(l.target.id).push(l.source);
});

function computeVisibleNodes() {
    const visibleNodes = new Set();
    const nodeById = new Map(data.nodes.map(n => [n.id, n]));

    data.nodes.forEach(n => {
        if (visibleGroups.has(n.group)) {
            visibleNodes.add(n.id);
        }
    });

    let changed = true;
    while (changed) {
        changed = false;
        visibleNodes.forEach(nodeId => {
            const nodeData = nodeById.get(nodeId);
            if (nodeData.group === GROUP_ROOT) return;

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

    node.style('display', d => visibleNodes.has(d.id) ? null : 'none');

    link.style('display', d => {
        return visibleNodes.has(d.source.id) && visibleNodes.has(d.target.id) ? null : 'none';
    });

    simulation.alpha(0.3).restart();
}

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

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

function centerOnNode(nodeData) {
    const scale = 1.5;
    const tx = width / 2 - nodeData.x * scale;
    const ty = height / 2 - nodeData.y * scale;
    svg.transition().duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

    selectedNodeId = nodeData.id;
    updateDimming();
    showNodeInfo(nodeData);
}

const nodeInfo = document.getElementById('nodeInfo');
const nodeById = new Map(data.nodes.map(n => [n.id, n]));
const groupLabels = { 0: 'Root', 1: 'Production', 2: 'Dev', 3: 'Transitive' };

function getConnections(nodeId) {
    const conns = [];
    data.links.forEach(l => {
        const srcId = typeof l.source === 'object' ? l.source.id : l.source;
        const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
        if (srcId === nodeId) {
            const existingConns = conns.filter(connection => connection.id === tgtId && connection.direction === 'out');
            if (!existingConns.length) {
                conns.push({ id: tgtId, direction: 'out' });
            }
        }
        else if (tgtId === nodeId) {
            const existingConns = conns.filter(connection => connection.id === srcId && connection.direction === 'in');
            if (!existingConns.length) {
                conns.push({ id: srcId, direction: 'in' });
            }
        }
    });
    conns.sort((a, b) => a.id.localeCompare(b.id));
    return conns;
}

function showNodeInfo(d) {
    const conns = getConnections(d.id);
    nodeInfo.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'node-info-header';
    const title = document.createElement('div');
    title.className = 'node-info-title';
    const dot = document.createElement('div');
    dot.className = 'node-info-dot';
    dot.style.background = colorScale(d.group);
    const name = document.createElement('span');
    name.className = 'node-info-name';
    name.textContent = d.id;
    name.title = d.id;
    title.appendChild(dot);
    title.appendChild(name);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'node-info-close';
    closeBtn.innerHTML = '&#215;';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedNodeId = null;
        updateDimming();
        hideNodeInfo();
    });
    header.appendChild(title);
    header.appendChild(closeBtn);
    nodeInfo.appendChild(header);

    const body = document.createElement('div');
    body.className = 'node-info-body';
    const sectionLabel = document.createElement('div');
    sectionLabel.className = 'node-info-section';
    sectionLabel.textContent = 'Connections (' + conns.length + ')';
    body.appendChild(sectionLabel);

    if (conns.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'node-info-empty';
        empty.textContent = 'No connections';
        body.appendChild(empty);
    } else {
        conns.forEach(c => {
            const connNode = nodeById.get(c.id);
            if (!connNode) return;
            const item = document.createElement('div');
            item.className = 'node-info-conn';
            const cDot = document.createElement('div');
            cDot.className = 'node-info-conn-dot';
            cDot.style.background = colorScale(connNode.group);
            const cLabel = document.createElement('span');
            cLabel.textContent = c.id;
            item.appendChild(cDot);
            item.appendChild(cLabel);
            item.addEventListener('click', () => {
                centerOnNode(connNode);
            });
            body.appendChild(item);
        });
    }

    nodeInfo.appendChild(body);
    nodeInfo.classList.add('visible');
}

function hideNodeInfo() {
    nodeInfo.classList.remove('visible');
}

function performSearch(term) {
    searchResults.innerHTML = '';
    if (!term) {
        searchResults.classList.remove('visible');
        return;
    }
    const lower = term.toLowerCase();
    const matches = data.nodes.filter(n => n.id.toLowerCase().includes(lower));
    if (matches.length === 0) {
        searchResults.innerHTML = '<div class="search-result-count">No matches</div>';
        searchResults.classList.add('visible');
        return;
    }
    const countEl = document.createElement('div');
    countEl.className = 'search-result-count';
    countEl.textContent = matches.length + ' result' + (matches.length === 1 ? '' : 's');
    searchResults.appendChild(countEl);
    matches.sort((a, b) => a.id.localeCompare(b.id));
    matches.forEach(m => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        const dot = document.createElement('div');
        dot.className = 'search-result-dot';
        dot.style.background = colorScale(m.group);
        const label = document.createElement('span');
        label.textContent = m.id;
        item.appendChild(dot);
        item.appendChild(label);
        item.addEventListener('click', () => {
            centerOnNode(m);
            searchResults.classList.remove('visible');
            searchInput.value = m.id;
        });
        searchResults.appendChild(item);
    });
    searchResults.classList.add('visible');
}

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        performSearch(searchInput.value.trim());
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
        searchResults.classList.remove('visible');
    }
});
