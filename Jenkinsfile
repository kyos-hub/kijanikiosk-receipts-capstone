pipeline {
    agent any

    environment {
        AWS_DEFAULT_REGION = 'us-east-1'
        AWS_ACCESS_KEY_ID = credentials('aws-access-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-access-key')
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm install --ignore-scripts'
            }
        }

        stage('Local Chain Test') {
            steps {
                sh 'node tests/local-chain-test.js'
            }
        }

        stage('Deploy to Staging') {
            steps {
                sh 'npx --no-install serverless deploy --stage staging'
            }
        }

        stage('Smoke Check: Staging Info') {
            steps {
                sh 'npx --no-install serverless info --stage staging'
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
                sh 'npx --no-install serverless deploy --stage prod'
            }
        }
    }

    post {
        failure {
            echo 'Pipeline failed — check the failed stage logs above.'
        }
    }
}
