# syntax=docker/dockerfile:1.7

FROM registry.redhat.io/ubi9/openjdk-21:latest AS build
USER root
WORKDIR /workspace

COPY pom.xml .
COPY src ./src

RUN mvn -DskipTests package

FROM registry.redhat.io/ubi9/openjdk-21-runtime:latest
WORKDIR /work/

COPY --from=build /workspace/target/quarkus-app/lib/ /work/lib/
COPY --from=build /workspace/target/quarkus-app/*.jar /work/
COPY --from=build /workspace/target/quarkus-app/app/ /work/app/
COPY --from=build /workspace/target/quarkus-app/quarkus/ /work/quarkus/

ENV QUARKUS_HTTP_HOST=0.0.0.0
EXPOSE 8080 8443

USER 185
ENTRYPOINT ["java","-jar","/work/quarkus-run.jar"]
