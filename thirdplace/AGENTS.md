<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Project description

Project name: thirdplace
This is a navigation app taylored to help disabled people avoid difficult obstacles.
The problem: navigation apps like Google Maps and Waze don't filter out physical obstacles that are difficult
for disabled people to navigate (eg. stairs, steep slopes). We are a specialized navigation app meant to recommend
the easiest route for these people, even if it's not necessarily the shortest.

## Landing page

The landing page is a simple geographical map, in which the user can search their destination they want to go to.
The user can also choose a few preferences between:
- Strictly no stairs

## Features

In decision:
- Show what the user can access in a specific time (eg. what restaurants they can go to with 10 min travel time)

# Tech stack

- Data Source: OpenStreetMap
- Elevation data: Valhalla API
- Routing Engine: Valhalla
- Database: not decided yet
- Tile Server: Valhalla
- Map Rendering: react-map-gl

Valhalla docs: https://valhalla.github.io/valhalla/