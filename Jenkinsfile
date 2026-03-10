pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command: ["/busybox/cat"]
    tty: true
    volumeMounts:
      - name: kaniko-secret
        mountPath: /kaniko/.docker
  - name: helm
    image: alpine/helm:latest
    command: ["/bin/sh", "-c"]
    args: ["tail -f /dev/null"]
  volumes:
    - name: kaniko-secret
      emptyDir: {}
'''
        }
    }

    environment {
        // Tu usuario de Docker Hub
        REGISTRY = "uzbuzbiz" 
        DOMAIN = "uzbuzbiz.es"
        NAMESPACE = "punto-vuela"
    }

    stages {
        stage('Build & Push Backend') {
            steps {
                container('kaniko') {
                    // Usamos las credenciales de Jenkins para loguearnos en Docker Hub
                    withCredentials([usernamePassword(credentialsId: 'docker-hub-creds', 
                                                    usernameVariable: 'DOCKER_USER', 
                                                    passwordVariable: 'DOCKER_PASS')]) {
                        script {
                            sh """
                            echo "{\\\"auths\\\":{\\\"https://index.docker.io/v1/\\\":{\\\"auth\\\":\\\"\$(echo -n \${DOCKER_USER}:\${DOCKER_PASS} | base64)\\\"}}}" > /kaniko/.docker/config.json
                            
                            /kaniko/executor --context ${WORKSPACE} \
                                --dockerfile ${WORKSPACE}/backend/Dockerfile \
                                --destination ${REGISTRY}/vuela-backend:latest \
                                --destination ${REGISTRY}/vuela-backend:${env.BUILD_ID}
                            """
                        }
                    }
                }
            }
        }

        stage('Build & Push Frontend') {
            steps {
                container('kaniko') {
                    withCredentials([usernamePassword(credentialsId: 'docker-hub-creds', 
                                                    usernameVariable: 'DOCKER_USER', 
                                                    passwordVariable: 'DOCKER_PASS')]) {
                        script {
                            sh """
                            /kaniko/executor --context ${WORKSPACE} \
                                --dockerfile ${WORKSPACE}/frontend/Dockerfile \
                                --destination ${REGISTRY}/vuela-frontend:latest \
                                --destination ${REGISTRY}/vuela-frontend:${env.BUILD_ID} \
                                --build-arg API_URL=https://${DOMAIN}/api
                            """
                        }
                    }
                }
            }
        }

        stage('Deploy con Helm') {
            steps {
                container('helm') {
                    sh """
                    helm upgrade --install punto-vuela ./helm \
                        --namespace ${env.NAMESPACE} --create-namespace \
                        --set backend.image=${REGISTRY}/vuela-backend \
                        --set backend.tag=${env.BUILD_ID} \
                        --set frontend.image=${REGISTRY}/vuela-frontend \
                        --set frontend.tag=${env.BUILD_ID} \
                        --wait --timeout 5m
                    """
                }
            }
        }
    }
}