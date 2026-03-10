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
      - name: docker-config
        mountPath: /kaniko/.docker
  - name: helm
    image: alpine/helm:latest
    command: ["/bin/sh", "-c"]
    args: ["tail -f /dev/null"]
  volumes:
    - name: docker-config
      configMap:
        name: docker-config
'''
        }
    }

    environment {
        REGISTRY = "localhost:32000" // Registro interno de MicroK8s
        DOMAIN = "uzbuzbiz.es"
        NAMESPACE = "punto-vuela"
    }

    stages {
        stage('Build Backend con Kaniko') {
            steps {
                container('kaniko') {
                    script {
                        sh """
                        /kaniko/executor --context ${WORKSPACE} \
                            --dockerfile ${WORKSPACE}/backend/Dockerfile \
                            --destination ${REGISTRY}/vuela-backend:latest \
                            --destination ${REGISTRY}/vuela-backend:${BUILD_ID}
                        """
                    }
                }
            }
        }

        stage('Build Frontend con Kaniko') {
            steps {
                container('kaniko') {
                    sh """
                    /kaniko/executor --context ${WORKSPACE} \
                        --dockerfile ${WORKSPACE}/frontend/Dockerfile \
                        --destination ${REGISTRY}/vuela-frontend:latest \
                        --destination ${REGISTRY}/vuela-frontend:${BUILD_ID}
                    """
                }
            }
        }

        stage('Deploy con Helm') {
            steps {
                container('helm') {
                    sh """
                    helm upgrade --install punto-vuela ./helm \
                        --namespace ${env.NAMESPACE} --create-namespace \
                        --set backend.tag=${env.BUILD_ID} \
                        --set frontend.tag=${env.BUILD_ID}
                    """
                }
            }
        }
    }
}