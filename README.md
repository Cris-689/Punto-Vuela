1. Variables en el Jenkinsfile

En la sección environment del Jenkinsfile, es necesario modificar los valores que definen el destino de las imágenes y el acceso de red:

    REGISTRY: Cambia "uzbuzbiz" por tu nuevo nombre de usuario de Docker Hub o la dirección de tu registro privado.

    DOMAIN: Sustituye "uzbuzbiz.es" por el nuevo dominio que vayas a utilizar (ej. nuevo-dominio.com).

    NAMESPACE: Define el nombre del espacio de nombres de Kubernetes donde se instalará la aplicación (actualmente "punto-vuela").

    credentialsId: Asegúrate de que en Jenkins exista una credencial de tipo "Username with password" con el ID 'docker-hub-creds' que contenga el nuevo usuario y contraseña del registro de contenedores.

2. Configuración en Helm (helm/values.yaml)

Estas variables son utilizadas por Kubernetes para desplegar los contenedores y configurar el acceso externo:

    backend.image y frontend.image: Debes actualizar la ruta de la imagen para que coincida con el nuevo REGISTRY definido en Jenkins.

    ingress.host: Cambia "uzbuzbiz.es" por el nuevo dominio.

    ingress.tlsSecret: Nombre del secreto que contendrá el certificado SSL para el nuevo dominio (actualmente "vuela-cert-tls"). Deberás crear este secreto en Kubernetes previamente.

3. Variables de Entorno del Backend

El código del servidor (backend/src/server.js) requiere que se definan las siguientes variables de entorno, que generalmente se inyectan a través de un Secret o un ConfigMap en Kubernetes:

    JWT_SECRET: Una cadena de texto aleatoria y compleja utilizada para firmar los tokens de autenticación. Es obligatoria para que el servidor arranque.

    ADMIN_DNI: El DNI que tendrá privilegios de administrador en la nueva plataforma.

    ADMIN_PASSWORD: La contraseña asociada a la cuenta de administrador.

    PORT: (Opcional) El puerto donde escucha el backend, por defecto es 3000.

4. Variables de Construcción (Build Args)

Durante la construcción del Frontend, el Jenkinsfile inyecta automáticamente una variable basada en el dominio:

    API_URL: Se genera automáticamente como https://${DOMAIN}/api. Si cambias la variable DOMAIN en el Jenkinsfile, esta se actualizará sola, pero es vital que el nuevo dominio tenga configurado el certificado SSL para que la comunicación sea segura
