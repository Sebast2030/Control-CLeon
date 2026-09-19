# ==========================================================
# Comercializadora Leon - Imagen del backend para Render
# ==========================================================
# Render construye esta imagen desde GitHub en cada despliegue.
# Las contrasenas NO van aqui: se configuran como variables de entorno en Render
# (ver DESPLIEGUE.md).

# ---- 1. Compilacion ----
FROM eclipse-temurin:17-jdk AS compilacion
WORKDIR /app

# Primero solo lo necesario para bajar dependencias: si no cambia el pom.xml, Docker
# reutiliza esta capa y los despliegues siguientes son mas rapidos.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline

COPY src/ src/
# Los tests necesitan una base de datos real; se corren en el PC antes de subir.
RUN ./mvnw -B -q package -DskipTests

# ---- 2. Ejecucion ----
# Solo el JRE (sin compilador ni Maven): imagen mas chica y con menos que atacar.
FROM eclipse-temurin:17-jre
WORKDIR /app

# El backend no corre como root dentro del contenedor.
RUN useradd --system --no-create-home --uid 10001 cleon
COPY --from=compilacion /app/target/*.jar app.jar
USER cleon

ENV SPRING_PROFILES_ACTIVE=prod
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
