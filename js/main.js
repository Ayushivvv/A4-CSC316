// A4-CSC3161/js/main.js

// A global variable to hold the hierarchical data
let chartData = null;
// A global variable to hold the original flat CSV data
let originalFlatData = null;

// --- START OF MODIFICATION (Hard-coded Global Color Scale) ---
// Define the domain (all 18 unique genres from the CSV)
const genreDomain = [
    'Afrobeats', 'Alternative', 'Alternative Pop', 'Country', 'Country-Pop',
    'Country-Rap', 'EDM/Pop', 'Electronic', 'Electronic/Disco', 'Hip Hop',
    'Hyperpop', 'K-Pop', 'Pop', 'Pop-Rock', 'R&B', 'R&B/Funk',
    'R&B/Pop', 'Soul-Pop'
];

// Define the hard-coded range of 18 colors
const genreRange = [

    '#E9B0C8', // Afrobeats ()
    '#4682B4', // Alternative ()
    '#FABB57', // Alternative Pop ()
    '#B8860B', // Country ()
    '#D76A4C', // Country-Pop ()
    '#20BD20', // Country-Rap ()
    '#FADD8B', // EDM/Pop ()
    '#9400D3', // Electronic ()
    '#FF1493', // Electronic/Disco ()
    '#1E90FF', // Hip Hop ()
    '#A4BDE0', // Hyperpop ()
    '#55B3CF', // K-Pop ()
    '#67C7C4', // Pop ()
    '#E9967A', // Pop-Rock ()
    '#274F8B', // R&B
    '#6A5ACD', // R&B/Funk
    '#25533F', // R&B/Pop
    '#C9D763' // Soul-Pop
];

// Create the single global color scale
// Both renderChart and updateLegend will use this.
const globalGenreColorScale = d3.scaleOrdinal()
    .domain(genreDomain)
    .range(genreRange)
    .unknown("#808080"); // Fallback for any unknown genres
// --- END OF MODIFICATION ---


// rendering function (remains the same as before)
function renderChart(d3, data) {
    const mount = document.getElementById("viz");
    if (!mount) return;

    // Remove the existing SVG element ==> clear state
    d3.select(mount).select("svg").remove();

    // One-time HTML tooltip (styled in css as #viz-tooltip)
    let tip = document.getElementById("viz-tooltip");
    if (!tip) {
        tip = document.createElement("div");
        tip.id = "viz-tooltip";
        document.body.appendChild(tip);
    }

    // --- MODIFICATION 2: Update showTip to accept HTML ---
    const showTip = (html, x, y) => {
        tip.innerHTML = html; // Use innerHTML instead of textContent
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
        tip.style.display = "block";
    };
    // --- END OF MODIFICATION 2 ---

    const hideTip = () => (tip.style.display = "none");


    // Define core chart creation logic (shifting within rendering)
    function createChart(d3, data) {
        // Specify the chart’s dimensions. (These change on resize)
        const rect = mount.getBoundingClientRect();
        const width = Math.max(360, rect.width);
        const height = Math.max(480, rect.height);

        // colours (from new CSS)
        const RED = "#ff4d4f";
        const WHITE = "#ffffff";

        // --- MODIFICATION: Use the new global, hard-coded color scale ---
        const color = globalGenreColorScale;
        // --- END OF MODIFICATION ---

        // Compute the layout. ( relies on new width/height)
        const pack = data => d3.pack()
            .size([width, height])
            .padding(31)
            (d3.hierarchy(data)
                .sum(d => d.value) // This sum works because of the logic in processAndRender
                .sort((a, b) => b.value - a.value));

        const root = pack(data);

        // --- START OF MODIFICATION (Dynamic Font Scale) ---
        // Find the min and max radius for song circles (depth 2)
        const songCircles = root.descendants().filter(d => d.depth === 2);

        // --- FIX for empty filtered data ---
        let minRadius = 10, maxRadius = 50; // Default values
        if (songCircles.length > 0) {
            const [minR, maxR] = d3.extent(songCircles, d => d.r);
            minRadius = minR;
            maxRadius = maxR;
        }
        // --- END OF FIX ---

        // Define the desired font size range
        const maxFontSize = 30; // The original max size
        const minFontSize = maxFontSize * 0.75; // 50% smaller as requested (13.5px)

        // Create a linear scale to map radius to font size
        const songFontSizeScale = d3.scaleLinear()
            .domain([minRadius, maxRadius])
            .range([minFontSize, maxFontSize])
            .clamp(true); // Clamp to ensure font size doesn't go out of bounds
        // --- END OF MODIFICATION ---


        // Create the SVG container.
        const svg = d3.create("svg")
            .attr("viewBox", `-${width} -${height} ${width * 2} ${height * 2}`) // Zoom-out change
            .attr("width", width)
            .attr("height", height)
            .attr("style", `max-width:100%;
                  height: ${height}px; 
                  display: block; 
                  margin: auto; 
                  background: transparent; 
                  cursor: pointer;`);

        // Add a circle for each node.
        const node = svg.append("g")
            .selectAll("circle")
            .data(root.descendants().slice(1))
            .join("circle")
            .attr("transform", d => `translate(${d.x},${d.y})`)
            // --- MODIFICATION 2: Update Fill and Stroke Logic ---
            .attr("fill", d => (
                d.children ? RED : color(d.data.genre) // Artist (parent) = RED, Song (leaf) = genre color
            ))
            .attr("stroke", d => (
                d.children ? WHITE : d3.color(color(d.data.genre)).darker(0.7) // Artist stroke = WHITE, Song stroke = darker genre color
            ))
            // --- End of Modifications ---
            .attr("stroke-width", 1)

            // --- MODIFICATION 3: Update mouseover logic ---
            .on("mouseover", function (event, d) {
                d3.select(this).attr("stroke", "#000"); // Use black stroke for hover highlight

                // Show tooltip logic
                if (d.depth === 1 && focus === root) {
                    // Artist hover (zoomed out)

                    // --- START OF REPLACEMENT ---

                    // Format follower count
                    const followers = d.data.followerCount ? (+d.data.followerCount).toLocaleString() : 'N/A';

                    // Format total views
                    const totalViewsFormatted = d.data.totalViews ? d.data.totalViews.toLocaleString() : 'N/A';

                    // Format total duration (in seconds)
                    const totalDurationFormatted = d.data.totalDuration ? d.data.totalDuration.toLocaleString() + ' sec' : 'N/A';

                    // --- START OF NEW MODIFICATION ---
                    // Format average duration
                    const avgDurationFormatted = d.data.averageDuration ? d.data.averageDuration.toFixed(1) + ' sec' : 'N/A';
                    const songCountDisplay = d.data.songCount || 0;
                    // --- END OF NEW MODIFICATION ---


                    // Create HTML string for the artist tooltip
                    const html = `
                        <strong style="font-size: 14px; display: block; margin-bottom: 4px;">${d.data.name}</strong>
                        <div style="font-size: 12px; opacity: 0.9;">
                            <strong>Followers:</strong> ${followers}<br>
                            <strong>Total Views:</strong> ${totalViewsFormatted}<br>
                            <strong>Total Duration:</strong> ${totalDurationFormatted}<br>
                            <strong>Avg. Duration:</strong> ${avgDurationFormatted} (${songCountDisplay} ${songCountDisplay === 1 ? 'song' : 'songs'})
                        </div>
                    `;
                    showTip(html, event.clientX, event.clientY);

                    // --- END OF REPLACEMENT ---

                } else if (d.depth === 2 && d.parent === focus) {
                    // Song hover (zoomed in)

                    // Format views
                    const views = d.data.views ? (+d.data.views).toLocaleString() : 'N/A';

                    // Clean up tags
                    const tags = d.data.tags ? d.data.tags.split(';').join(', ') : 'No tags';
                    let tagsDisplay = tags;
                    if (tags.length > 150) {
                        tagsDisplay = tags.substring(0, 150) + '...';
                    }

                    // --- START OF MODIFICATION (Genre in Tooltip) ---
                    // Create HTML string for the tooltip
                    const html = `
                        <img src="${d.data.thumbnail}" alt="${d.data.name}" style="width: 100%; max-width: 220px; display: block; margin-bottom: 8px; border-radius: 4px;">
                        <strong style="font-size: 14px; display: block; margin-bottom: 4px;">${d.data.name}</strong>
                        <div style="font-size: 12px; opacity: 0.9;">
                            <strong>Views:</strong> ${views}<br>
                            <strong>Duration:</strong> ${d.data.duration || 'N/A'}<br>
                            <strong>Genre:</strong> ${d.data.genre || 'N/A'}
                        </div>
                        <div style="font-size: 10px; opacity: 0.7; margin-top: 6px; max-height: 60px; overflow-y: auto; border-top: 1px solid #444; padding-top: 4px;">
                            <strong>Tags:</strong> ${tagsDisplay}
                        </div>
                    `;
                    // --- END OF MODIFICATION (Genre in Tooltip) ---

                    showTip(html, event.clientX, event.clientY);
                }
            })
            // --- END OF MODIFICATION 3 ---

            .on("mouseout", function () {
                d3.select(this).attr("stroke", null); // Revert to original stroke (set by .attr("stroke", ...))
                // Hide tooltip logic
                hideTip();
            })

            // --- START OF MODIFICATION (URL Click) ---
            .on("click", (event, d) => {
                // Hide tooltip on click
                hideTip();

                if (d.children) {
                    // It's an artist (parent) circle
                    if (focus !== d) { // Not already focused
                        zoom(event, d); // Zoom in
                        event.stopPropagation(); // Stop the click from bubbling to the SVG
                    }
                } else {
                    // It's a song (leaf) circle

                    // Check if we are zoomed in to the parent artist
                    if (focus === d.parent) {
                        // User's new request: Open URL in new tab
                        if (d.data.url) {
                            window.open(d.data.url, '_blank');
                        }
                        // We must stop propagation, otherwise the click on the SVG
                        // will fire and zoom us out to the root.
                        event.stopPropagation();
                    } else {
                        // This is the old "fix" logic
                        // If we're not zoomed in on the parent (e.g., we are at the root)
                        // just zoom to the parent artist.
                        zoom(event, d.parent);
                        event.stopPropagation();
                    }
                }
            });
        // --- END OF MODIFICATION (URL Click) ---

        // Add a label for each node.
        const label = svg.append("g")
            .style("font", "10px sans-serif")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .selectAll("text")
            .data(root.descendants())
            .join("text")
            .style("fill-opacity", d => d.parent === root ? 1 : 0)
            .style("display", d => d.parent === root ? "inline" : "none")
            .text(d => d.data.name)
            // --- START OF MODIFICATION (Dynamic Font Size & Artist Readability) ---
            .style("font-size", d => {
                if (d.depth === 0) return "10px"; // Root
                if (d.depth === 1) return "24px"; // Artist
                if (d.depth === 2) return `${songFontSizeScale(d.r)}px`; // Dynamic song font size
                return "10px"; // Fallback
            })
            .style("font-weight", d => d.depth === 1 ? "bold" : "normal")
            // --- Styles for readability ---
            .style("fill", d => {
                if (d.depth === 2) return "#000"; // Songs = black
                if (d.depth === 1) return "#000"; // Artists = black
                return "#444"; // Root = gray
            })
            .style("stroke", d => {
                if (d.depth === 2) return "#fff"; // Songs = white stroke
                if (d.depth === 1) return "#fff"; // Artists = white stroke (for readability)
                return "none";
            })
            .style("stroke-width", d => {
                if (d.depth === 2) return "3px"; // 3px stroke for songs
                if (d.depth === 1) return "2.5px"; // 2.5px stroke for artists
                return "0px";
            })
            .style("paint-order", "stroke") // Paint stroke behind fill
            // --- END OF MODIFICATION ---
            .text(d => d.data.name).each(function (d) {

                const textWidth = this.getComputedTextLength();
                if (textWidth > d.r * 1.8) d3.select(this).style("display", "none");
            });

        // Create the zoom behavior and zoom immediately in to the initial focus node. (Original logic)
        svg.on("click", (event) => zoom(event, root));
        let focus = root;
        let view;
        zoomTo([focus.x, focus.y, focus.r * 2]);

        function zoomTo(v) {
            // --- THIS IS THE MODIFIED LINE ---
            const k = Math.min(width, height) * 2 / v[2];
            // --- END OF MODIFIED LINE ---

            view = v;
            label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
            node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
            node.attr("r", d => d.r * k);
        }

        // --- THIS IS THE MODIFIED ZOOM FUNCTION ---
        function zoom(event, d) {
            // 1. If clicking on the same spot, do nothing
            if (focus === d) return;

            focus = d; // Set new focus

            // 2. Immediately hide all currently visible labels
            label
                .filter(function() { return this.style.display === "inline"; })
                .style("fill-opacity", 0)
                .style("display", "none");

            // 3. Start the zoom transition for circles and labels
            const transition = svg.transition()
                .duration(event.altKey ? 5500 : 500)
                .tween("zoom", d => {
                    const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                    return t => zoomTo(i(t));
                });

            // 4. At the end of the zoom, show the new labels
            transition.on("end", () => {
                // After zoom is complete, show the new labels
                label
                    .filter(function(d) { return d.parent === focus; }) // Get new labels
                    .style("display", "inline") // Set to display
                    .style("fill-opacity", 0) // Start invisible
                    .transition().duration(50) // FASTER fade-in
                    .style("fill-opacity", 1);

                // Ensure old labels are definitely hidden
                label
                    .filter(function(d) { return d.parent !== focus; })
                    .style("display", "none");
            });
        }
        // --- END OF MODIFIED ZOOM FUNCTION ---

        return svg.node();
    }

    // Append the newly created chart to the #viz mount point
    const chart = createChart(d3, data);
    mount.appendChild(chart);
}


// New function to process flat data into hierarchical data and render the chart
function processAndRender(d3, dataToProcess, metricForValue) {
    // Group data by channel (artist)
    const grouped = d3.group(dataToProcess, d => d.channel);

    // Convert flat CSV to hierarchical structure for the chart
    chartData = {
        name: "Youtube Top 100",
        children: Array.from(grouped, ([key, values]) => {

            // --- NEW CALCULATION START ---
            let totalViews = 0;
            let totalDuration = 0;
            const songCount = values.length;
            const artistFollowers = +values[0].channel_follower_count || 0;

            // Calculate totals for this artist
            values.forEach(d => {
                totalViews += +d.view_count || 0;
                totalDuration += +d.duration || 0; // Use the numeric duration
            });

            const averageDuration = songCount > 0 ? totalDuration / songCount : 0;
            // --- NEW CALCULATION END ---


            return {
                name: key,
                // --- Add all calculated data to the parent node ---
                followerCount: artistFollowers,
                totalViews: totalViews,
                totalDuration: totalDuration,
                songCount: songCount,
                averageDuration: averageDuration,
                // --- END ---

                // --- THIS IS THE CORE LOGIC FIX ---
                children: values.map(d => {

                    let nodeValue; // This will be the value d3.pack sums
                    const songViews = +d.view_count || 0;
                    const songDuration = +d.duration || 0;

                    switch (metricForValue) {
                        case 'duration':
                            // PARENT SIZES BY: averageDuration
                            // We make each song's value a *proportion* of the average.
                            // (songDuration / totalDuration) * averageDuration
                            // The sum of nodeValues will equal averageDuration.
                            nodeValue = (totalDuration > 0)
                                ? (songDuration / totalDuration) * averageDuration
                                : 0;
                            break;

                        case 'channel_follower_count':
                            // PARENT SIZES BY: artistFollowers
                            // We size songs *proportionally to their views* to fill the parent bubble.
                            // (songViews / totalViews) * artistFollowers
                            // The sum of nodeValues will equal artistFollowers.
                            nodeValue = (totalViews > 0)
                                ? (songViews / totalViews) * artistFollowers
                                : 0;
                            break;

                        case 'view_count':
                        default:
                            // PARENT SIZES BY: totalViews
                            // The song's value is simply its own view count.
                            // The sum of nodeValues will equal totalViews.
                            nodeValue = songViews;
                            break;
                    }

                    return {
                        name: d.title,
                        value: nodeValue, // <-- This value is used by d3.pack().sum()
                        genre: d.genre,

                        // --- Add raw data for tooltip ---
                        thumbnail: d.thumbnail,
                        views: d.view_count, // Use the original view_count for display
                        duration: d.duration_string, // Use string for song tooltip
                        tags: d.tags,
                        url: d.url
                    };
                })
                // --- END OF CORE LOGIC FIX ---
            };
        })
    };

    // Chart render
    renderChart(d3, chartData);
}

// New filtering function
function applyFiltersAndRender(d3) {
    if (!originalFlatData) return;

    // 1. Get filter values from UI
    const filterMetric = document.getElementById('filter-metric-selector').value;
    const categoryFilter = document.getElementById('category-filter').value;
    const liveStatusFilter = document.getElementById('live-status-filter').value;

    // 2. Apply filters
    let filteredData = originalFlatData.filter(d => {
        // Quantitative filter (dynamic)
        if (filterMetric !== 'none') {
            // Filter out any row where the value for that metric is 0 or less.
            // This also handles invalid/empty data for the selected metric.
            if (+d[filterMetric] <= 0 || isNaN(+d[filterMetric])) return false;
        }

        // Categorical filter (Dropdown filter based on substring match)
        if (categoryFilter !== 'All') {
            // Check if the row's categories field does NOT contain the selected category string (case-insensitive)
            if (d.categories && d.categories.toLowerCase().indexOf(categoryFilter.toLowerCase()) === -1) return false;
        }

        // Boolean filter ('live_status' column is a string "TRUE" or "FALSE")
        if (liveStatusFilter !== 'All' && d.live_status !== liveStatusFilter) return false;

        return true;
    });

    // --- ADD THIS LINE ---
    // Update the legend based on the newly filtered data
    updateLegend(d3, filteredData);
    // --- END OF ADDED LINE ---

    // 3. Process and Render - PASS THE METRIC
    processAndRender(d3, filteredData, filterMetric);
}

// --- NEW FUNCTION TO ADD ---
// This function builds and updates the legend
function updateLegend(d3, filteredData) {
    const staticKeyMount = d3.select("#legend-static-key");
    const dynamicGenreMount = d3.select("#legend-dynamic-genres");

    // Clear previous legend items
    staticKeyMount.html("");
    dynamicGenreMount.html("");

    // --- 1. Add Static Key (Artist Color & Size) ---

    // Artist Color
    const artistItem = staticKeyMount.append("div").attr("class", "legend-item");
    artistItem.append("span")
        .attr("class", "legend-color-box")
        .style("background-color", "#ff4d4f"); // The RED from createChart
    artistItem.append("span")
        .text("Artist (Parent Circle)");

    // --- START: Updated Size Explanations ---
    staticKeyMount.append("p")
        .attr("class", "legend-description")
        .text("Artist circle size represents the total 'Views' or 'Channel Followers', OR the 'Average Duration', depending on the filter.");

    staticKeyMount.append("p")
        .attr("class", "legend-description")
        .text("Song circle size represents its share of the parent's total value (e.g., its view count, or its proportion of duration).");
    // --- END: Updated Size Explanations ---

    // --- 2. Add Dynamic Genre Key ---

    // --- MODIFICATION: Use the new global, hard-coded color scale ---
    const colorScaleForLegend = globalGenreColorScale;
    // --- END OF MODIFICATION ---

    // Get all unique, defined genres from the filtered data
    const genres = [...new Set(filteredData.map(d => d.genre))]
        .filter(g => g) // Remove undefined or null genres
        .sort();         // Sort alphabetically

    // Create a legend item for each genre
    genres.forEach(genre => {
        const color = colorScaleForLegend(genre); // This will now pull from the hard-coded scale
        const item = dynamicGenreMount.append("div").attr("class", "legend-item");
        item.append("span")
            .attr("class", "legend-color-box")
            .style("background-color", color);
        item.append("span")
            .text(genre);
    });
}
// --- END OF NEW FUNCTION ---


// Load and process the CSV data
d3.csv("data/youtube-top-100-songs-2025.csv").then(flatData => {
    // Store the original data globally
    originalFlatData = flatData;

    // Initial chart render (calling the filter function to apply any default filters from the HTML)
    applyFiltersAndRender(d3);

    // Add the resize event listener
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (chartData) {
                // Rerender with the current chartData on resize
                renderChart(d3, chartData);
            }
        }, 150);
    });

    // Add event listener for the filter button
    document.getElementById('apply-filter').addEventListener('click', () => {
        applyFiltersAndRender(d3);
    });
});