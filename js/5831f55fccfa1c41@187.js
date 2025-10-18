function createChart(d3, data) {
    // Specify the chart’s dimensions.
    var bg = "hsla(97, 49%, 68%, 1.00)";
    var colour_in = "hsla(235, 48%, 43%, 1.00)";

    var height = window.innerHeight;
    var width = window.innerWidth / 1.2;

    // Create the color scale.
    const color = d3.scaleLinear()
        .domain([0, 5])
        .range([bg, colour_in])
        .interpolate(d3.interpolateHcl);

    // Compute the layout.
    const pack = data => d3.pack()
        .size([width, height])
        .padding(24)
        (d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value));

    const root = pack(data);

    // changing the background as well
    d3.select("body").style("background-color", bg);

    // Create the SVG container.
    const svg = d3.create("svg")
        .attr("viewBox", `-${width/1.3} -${height / 1.3} ${width * 1.5} ${height * 1.5}`)
        .attr("width", width)
        .attr("height", height)
        .attr("style", `max-width:100%;
             height: ${height}px;
             display: block; 
             margin: auto; 
             background: ${color(0)}; 
             cursor: pointer;`);

    // Add centered title + subtitle
    const titleGroup = svg.append("g")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    titleGroup.append("text")
        .text("Youtube Top 100 Games")
        .style("font-size", "36px")
        .style("font-weight", "bold")
        .style("fill", "#111");  // same dark fill as depth=1 labels

    titleGroup.append("text")
        .text("By: Alisa, Ayushi, and Jonathan")
        .attr("dy", "2.5em")
        .style("font-size", "20px")
        .style("fill", "#444");  // same lighter fill as song labels

    // Reposition some child nodes
    root.each(d => {
        if (d.children && d.children.length === 2) {
            const [a, b] = d.children;
            const offset = a.r + b.r + 10;
            a.x = d.x;
            b.x = d.x;
            a.y = d.y - offset / 2;
            b.y = d.y + offset / 2;
        }
        if (d.children && d.children.length === 4) {
            const [a, b] = d.children;
            const offset = a.r + b.r + 10;
            a.x = d.x - 20;
            b.x = d.x + 20;
            a.y = d.y - offset / 4;
            b.y = d.y + offset / 4;
        }
    });

    // Append the nodes.
    const node = svg.append("g")
        .selectAll("circle")
        .data(root.descendants().slice(1))
        .join("circle")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .attr("fill", d => d.children ? color(d.depth) : "white")
        .attr("pointer-events", d => !d.children ? "none" : null)
        .on("mouseover", function () { d3.select(this).attr("stroke", "#000"); })
        .on("mouseout", function () { d3.select(this).attr("stroke", null); })
        .on("click", (event, d) => focus !== d && (zoom(event, d), event.stopPropagation()));

    // Append the text labels.
    const label = svg.append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .selectAll("text")
        .data(root.descendants())
        .join("text")
        .style("fill-opacity", d => d.parent === root ? 1 : 0)
        .style("display", d => d.parent === root ? "inline" : "none")
        .text(d => d.data.name)
        .style("font-size", d => {
            if (d.depth === 0) return "10px";   // root
            if (d.depth === 1) return "18px";   // artist
            return "27px";                      // songs
        })
        .style("font-weight", d => d.depth === 1 ? "bold" : "normal")
        .style("fill", d => d.depth === 1 ? "#111" : "#444")
        .text(d => d.data.name).each(function (d) {
            const textWidth = this.getComputedTextLength();
            if (textWidth > d.r * 1.8) d3.select(this).style("display", "none");
        });

    // Create the zoom behavior and zoom immediately in to the initial focus node.
    svg.on("click", (event) => zoom(event, root));
    let focus = root;
    let view;
    zoomTo([focus.x, focus.y, focus.r * 2]);

    function zoomTo(v) {
        const k = width / v[2];
        view = v;
        label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
        node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
        node.attr("r", d => d.r * k);
    }

    function zoom(event, d) {
        focus = d;
        const transition = svg.transition()
            .duration(event.altKey ? 7500 : 750)
            .tween("zoom", d => {
                const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                return t => zoomTo(i(t));
            });
        label
            .filter(function (d) { return d.parent === focus || this.style.display === "inline"; })
            .transition(transition)
            .style("fill-opacity", d => d.parent === focus ? 1 : 0)
            .on("start", function (d) { if (d.parent === focus) this.style.display = "inline"; })
            .on("end", function (d) { if (d.parent !== focus) this.style.display = "none"; });
    }

    return svg.node();
}

// Load and process the CSV data
d3.csv("data/youtube-top-100-songs-2025.csv").then(flatData => {
    // Group data by channel (artist)
    const grouped = d3.group(flatData, d => d.channel);

    // Convert flat CSV to hierarchical structure for the chart
    const hierarchicalData = {
        name: "Youtube Top 100",
        children: Array.from(grouped, ([key, values]) => ({
            name: key,
            children: values.map(d => ({
                name: d.title,
                value: +d.view_count // Ensure view_count is a number
            }))
        }))
    };

    const chart = createChart(d3, hierarchicalData);
    document.body.appendChild(chart);
});