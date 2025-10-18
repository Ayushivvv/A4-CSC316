# A4-CSC316

**By: Jonathan Qiao, Alisa Iskakova, and Ayushi Verma**

---

## Overview
This project is our prototype submission for **Assignment 4: Interactive Visualization (CSC316)**.
We chose to visualize the **YouTube Top 100 Songs (2025)** dataset. Each song is associated with its artist/channel and view count. We represent this data hierarchically, allowing users to explore relationships between artists and their songs, as well as the relative popularity of each.

---

## Visualization Design
- **Circle Packing Layout**:
    - **Biggest Circle** → Artist names
    - **Inside Circles** → Their songs that were on the top 100 lists. The songs are sized by their view count.
---

## Interaction & Animation Techniques
- **Zooming & Panning**: Click on an artist to zoom into their songs; click the background to zoom back out.
- **Hover Highlighting**: Circles highlight with a stroke on mouseover.
- **Details-on-Demand**: Labels are shown or hidden depending on zoom level and circle size.

These features allow users to drill down into specific artists, compare song popularity, and smoothly return to the global overview.

---

## Development Process
- Implemented with **D3.js (v7)**
- Data loaded from a **static CSV** (`youtube-top-100-songs-2025.csv`)
- Collaboration managed using **GitHub** for version control

---

## Future Improvements
- Include a **legend** or explanatory annotation for clarity
- Improve **mobile responsiveness and accessibility**

___
## Data Source
Dataset: **YouTube Top 100 Songs (2025)** (CSV file) from Kaggle.

___ 

## Inspiration:
- https://observablehq.com/@d3/zoomable-circle-packing 
---