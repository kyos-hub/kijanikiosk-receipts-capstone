pipeline {
    agent any

    environment {
        AWS_DEFAULT_REGION = 'us-east-1'
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Local Chain Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Deploy to Staging') {
            steps {
                sh 'npx serverless deploy --stage staging'
            }
        }

        stage('Smoke Check: Staging Info') {
            steps {
                sh 'npx serverless info --stage staging'
            }
        }

        stage('Production Approval Gate') {
            steps {
                script {
                    def approver = input(
                        message: 'Approve production deploy of kijanikiosk-receipts?',
                        submitterParameter: 'APPROVER',
                        parameters: [string(name: 'REASON', defaultValue: '', description: 'Reason for approval')]
                    )
                    echo "Approved by: ${approver}"
                }
            }
        }

        stage('Deploy to Production') {
            steps {
                sh 'npx serverless deploy --stage prod'
            }
        }
    }

    post {
        failure {
            echo 'Pipeline failed — check the failed stage logs above.'
        }
    }
}
