# Multi-stage build keeps the Render runtime image small.
FROM rust:slim-bookworm AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config ca-certificates && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml ./
COPY src ./src
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse CARGO_BUILD_JOBS=2
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* && useradd --system --uid 10001 app
WORKDIR /app
COPY --from=builder /app/target/release/android-testers-api /usr/local/bin/android-testers-api
USER 10001
ENV PORT=10000 RUST_LOG=info
EXPOSE 10000
CMD ["/usr/local/bin/android-testers-api"]
