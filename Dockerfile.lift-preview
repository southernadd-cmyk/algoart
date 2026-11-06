# Isolated lift-test tower. Does not replace the GitHub Pages live gallery.
FROM node:22-alpine AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY automation/build-phi-lift-test.mjs ./automation/
COPY gallery/ ./gallery/
RUN node automation/build-phi-lift-test.mjs

FROM node:22-alpine
RUN npm install --global serve@14.2.5
WORKDIR /site
COPY --from=builder /build/gallery/ ./gallery/
COPY css/ ./css/
COPY js/ ./js/
COPY fonts/ ./fonts/
COPY lift-preview/ ./lift-preview/
COPY favicon.svg ./favicon.svg
EXPOSE 3000
CMD ["sh", "-c", "serve --no-clipboard --listen tcp://0.0.0.0:${PORT:-3000} ."]
