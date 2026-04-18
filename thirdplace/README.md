This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

1. Navigate to `/thirdplace` and npm install (or pnpm install)
2. Download your favorite .osm map and move it in the `/routing-valhalla` directory
3. Run the valhalla container with:
   `MSYS_NO_PATHCONV=1 docker run -dt --name valhalla_server \
-p 8002:8002 \
-v "$PWD/routing-valhalla:/custom_files" \
-e build_elevation=True \
-e build_admins=True \
-e build_timezones=True \
-e force_rebuild=True \
-e concurrency=20 \
-e valhalla_id_table_size=100000000 \
ghcr.io/valhalla/valhalla-scripted:latest`

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
