import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Commit } from '@/src/lib/gitea';

interface GitGraphProps {
  commits: Commit[];
  width?: number;
  height?: number;
  onCommitClick?: (commit: Commit) => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  sha: string;
  message: string;
  author: string;
  date: string;
  lane: number;
  y: number;
  x: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string;
  target: string;
}

export function GitGraph({ commits, width = 800, height = 400, onCommitClick }: GitGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || commits.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Process commits to determine lanes and positions
    const sortedCommits = [...commits].sort((a, b) => 
      new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime()
    );

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const shaToNode = new Map<string, GraphNode>();
    const branchLanes = new Map<string, number>();
    let nextLane = 0;

    sortedCommits.forEach((commit, index) => {
      // Determine lane
      let lane = 0;
      if (commit.parents.length > 0) {
        const firstParent = commit.parents[0].sha;
        const parentNode = shaToNode.get(firstParent);
        if (parentNode) {
          lane = parentNode.lane;
        } else {
          lane = nextLane++;
        }
      } else {
        lane = nextLane++;
      }

      const node: GraphNode = {
        id: commit.sha,
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.author?.login || commit.commit.author.name,
        date: commit.commit.author.date,
        lane: lane,
        x: 40 + lane * 30,
        y: 40 + index * 50,
      };

      nodes.push(node);
      shaToNode.set(commit.sha, node);

      commit.parents.forEach(parent => {
        links.push({
          source: commit.sha,
          target: parent.sha
        });
      });
    });

    const maxLane = Math.max(...nodes.map(n => n.lane), 0);
    const dynamicWidth = Math.max(width, (maxLane + 1) * 30 + 200);
    const dynamicHeight = Math.max(height, commits.length * 50 + 100);

    svg.attr("width", dynamicWidth).attr("height", dynamicHeight);

    const g = svg.append("g").attr("transform", "translate(20, 20)");

    // Draw links
    g.selectAll(".link")
      .data(links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", (d: any) => {
        const source = shaToNode.get(d.source);
        const target = shaToNode.get(d.target);
        if (!source || !target) return "";

        // Create a curved path
        const path = d3.path();
        path.moveTo(source.x, source.y);
        if (source.lane === target.lane) {
          path.lineTo(target.x, target.y);
        } else {
          path.bezierCurveTo(
            source.x, (source.y + target.y) / 2,
            target.x, (source.y + target.y) / 2,
            target.x, target.y
          );
        }
        return path.toString();
      })
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.6);

    // Draw nodes
    const nodeGroups = g.selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node cursor-pointer group")
      .attr("transform", d => `translate(${d.x}, ${d.y})`)
      .on("click", (event, d) => {
        const commit = commits.find(c => c.sha === d.sha);
        if (commit && onCommitClick) {
          onCommitClick(commit);
        }
      });

    nodeGroups.append("circle")
      .attr("r", 6)
      .attr("fill", d => d3.schemeCategory10[d.lane % 10])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("class", "group-hover:stroke-sky-400 group-hover:r-8 transition-all duration-200");

    // Add message labels
    nodeGroups.append("text")
      .attr("x", 12)
      .attr("y", 4)
      .text(d => d.message.split('\n')[0])
      .attr("font-size", "11px")
      .attr("fill", "#334155")
      .attr("class", "font-medium group-hover:text-sky-600 transition-colors");

    // Add SHA labels
    nodeGroups.append("text")
      .attr("x", -12)
      .attr("y", 4)
      .text(d => d.sha.substring(0, 7))
      .attr("font-size", "10px")
      .attr("font-family", "monospace")
      .attr("fill", "#94a3b8")
      .attr("text-anchor", "end")
      .attr("class", "group-hover:fill-slate-400 transition-colors");

  }, [commits]);

  return (
    <div className="w-full overflow-auto bg-white border border-slate-200 rounded-xl shadow-sm">
      <svg 
        ref={svgRef} 
        className="block"
      />
    </div>
  );
}
