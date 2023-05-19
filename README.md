# DB Backup Lambda Cron Function

This project is a Serverless Framework project that contains a Lambda function that is triggered by an AWS EventBridge Rule. The Rule is configured to trigger the Lambda function depending on what is set in `serverless.yml` rate. The Lambda function is configured to backup a mysql database to a server using mysqldump and sftp.

## Prerequisites
- [Serverless Framework](https://www.serverless.com/framework/docs/getting-started/)

## Setup
To get started with this project, you'll need to have Node.js and npm installed on your machine. You can download them from the official website: https://nodejs.org/en/download/

Once you have Node.js and npm installed, you can clone this repository and install the dependencies by running the following commands:
  
  ```bash
  git clone https://github.com/vahiwe/db-backup-lambda-cron.git
  cd db-backup-lambda-cron
  npm install
  ```

## Configuration
- A parameter store parameter should be created with the name `lambda-ssh-key` and the value should be the private key that will be used to connect to the server. 
- The lambda function should have the following environment variables:
  - `DB_ENDPOINT` - The database endpoint to connect to
  - `DB_NAME` - The database name
  - `DB_USER` - The database user
  - `DB_PASS` - The database password
  - `DB_PORT` - The database port
  - `SFTP_HOST` - The sftp host
  - `SFTP_USER` - The sftp user
- The above mentioned environment variables should be set in the AWS console after deploying the lambda function. Do not set them in `serverless.yml` as they will be exposed in the repository.

### Additional things to note
- There's a `tools` folder that has the `mysqldump` and `gzip` executables for linux. These are used to create the database backup. If you want to use different versions of these executables, you can replace them with the ones you want to use. The executables should be named `mysqldump` and `gzip` respectively.
- The `x64` version of the executables are used. If you want to use a different architecture, you can replace them with the ones you want to use. The executables should be named `mysqldump` and `gzip` respectively.
- The `mysqldump` executable is used to create the database backup. The `gzip` executable is used to compress the database backup. The compressed database backup is then uploaded to the server using `sftp`.
- The `tools/lib` folder contains the `libcrypto.so.1.0.0` and `libssl.so.1.0.0` libraries that are required by the `mysqldump` executable. If you want to use different versions of these libraries, you can replace them with the ones you want to use. The libraries should be named `libcrypto.so.1.0.0` and `libssl.so.1.0.0` respectively.
- The reason for these extra configuration is because lambda doesn't have these executables and libraries installed by default. So we have to include them in the lambda function.

## Schedule event type

This project defines a function, `dbBackupHandler`, which is triggered by an event of `schedule` type, which is used for configuring functions to be executed at specific time or in specific intervals. For detailed information about `schedule` event, please refer to corresponding section of Serverless [docs](https://serverless.com/framework/docs/providers/aws/events/schedule/).

When defining `schedule` events, we need to use `rate` or `cron` expression syntax.

### Rate expressions syntax

```pseudo
rate(value unit)
```

`value` - A positive number

`unit` - The unit of time. ( minute | minutes | hour | hours | day | days )

In below example, we use `rate` syntax to define `schedule` event that will trigger our `rateHandler` function every minute

```yml
functions:
  dbBackupHandler:
    handler: handler.run
    events:
      - schedule: rate(1 minute)
```

Detailed information about rate expressions is available in official [AWS docs](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html#eb-rate-expressions).


### Cron expressions syntax

```pseudo
cron(Minutes Hours Day-of-month Month Day-of-week Year)
```

All fields are required and time zone is UTC only.

| Field         | Values         | Wildcards     |
| ------------- |:--------------:|:-------------:|
| Minutes       | 0-59           | , - * /       |
| Hours         | 0-23           | , - * /       |
| Day-of-month  | 1-31           | , - * ? / L W |
| Month         | 1-12 or JAN-DEC| , - * /       |
| Day-of-week   | 1-7 or SUN-SAT | , - * ? / L # |
| Year          | 192199      | , - * /       |

In below example, we use `cron` syntax to define `schedule` event that will trigger our `cronHandler` function every second minute every Monday through Friday

```yml
functions:
  cronHandler:
    handler: handler.run
    events:
      - schedule: cron(0/2 * ? * MON-FRI *)
```

Detailed information about cron expressions in available in official [AWS docs](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html#eb-cron-expressions).


## Usage

### Deployment

This project is made to work with the Serverless Framework.
Make sure you have the Serverless Framework installed and you are using Node.js v12.16.1 or higher.
Also, make sure you have your AWS credentials configured as described in this [guide](https://serverless.com/framework/docs/providers/aws/guide/credentials/). Usually, this is done by creating a new user in IAM and configuring `serverless` to use a profile for that user.
In order to deploy the function, you need to run the following command:

```
serverless deploy
```

After running deploy, you should see output similar to:

```bash
Deploying db-backup to stage dev (us-east-1)

✔ Service deployed to stack db-backup-dev (269s)

functions:
  dbBackupHandler: db-backup-dev-dbBackupHandler (6.1 MB)
```

There is no additional step required. Your defined schedules becomes active right away after deployment.

### Local invocation

In order to test out your functions, you can invoke the function from your cli:

```
serverless invoke --function dbBackupHandler
```

If the necessary environment variables have not been set, you will get an error.

If everything has been set correctly, after invocation, you should see output similar to:

```bash
"Success"
```

### Logs
To view the logs, you can run the following command:

```
serverless logs --function dbBackupHandler --tail
```

### Cleanup
To remove the function and all the resources created by serverless, you can run the following command:

```bash
serverless remove
```

This will remove all the resources created by serverless.