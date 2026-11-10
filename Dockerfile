# onnxruntime-node ships glibc binaries only, so this image is Debian-based (not alpine).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# Set by buildx (amd64 | arm64); selects which onnxruntime-node binary to keep.
ARG TARGETARCH
COPY package.json package-lock.json ./
COPY vendor ./vendor
# Inference is CPU-only: drop the other OS/arch binaries and the GPU provider libraries
# (CUDA alone is ~280 MB) that onnxruntime-node bundles.
RUN npm ci --omit=dev --ignore-scripts \
    && ORT_ARCH="$( [ "${TARGETARCH:-amd64}" = "arm64" ] && echo arm64 || echo x64 )" \
    && cd node_modules/onnxruntime-node/bin/napi-v6 \
    && rm -rf darwin win32 \
    && find linux -mindepth 1 -maxdepth 1 ! -name "$ORT_ARCH" -exec rm -rf {} + \
    && rm -f linux/"$ORT_ARCH"/libonnxruntime_providers_cuda.so linux/"$ORT_ARCH"/libonnxruntime_providers_tensorrt.so \
    && npm cache clean --force
COPY --from=build /app/dist ./dist

# The exported ONNX model is NOT baked into the image: mount it at /models
# (docker run -v /path/to/laya-onnx/multilingual:/models:ro ...). The files must be readable by uid 1000.
ENV LAYA_MODEL_DIR=/models
ENV MCP_TRANSPORT=http
ENV MCP_HTTP_PORT=3005
ENV MCP_HTTP_HOST=0.0.0.0
EXPOSE 3005

USER node
CMD ["node", "dist/index.js"]
