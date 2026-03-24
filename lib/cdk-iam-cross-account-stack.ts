import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface CdkIamCrossAccountStackProps extends cdk.StackProps {
  /** ARN of the OpenClaw EC2 instance role in the dev account */
  trustedRoleArn: string;
}

export class CdkIamCrossAccountStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: CdkIamCrossAccountStackProps,
  ) {
    super(scope, id, props);

    const role = new iam.Role(this, "OpenClawCrossAccountRole", {
      roleName: "OpenClawCrossAccountRole",
      assumedBy: new iam.ArnPrincipal(props.trustedRoleArn),
      description:
        "Allows the OpenClaw EC2 instance (dev account) to read CloudWatch, Step Functions, and invoke Lambda in this account",
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "cloudwatch:DescribeAlarms",
          "cloudwatch:DescribeAlarmHistory",
          "cloudwatch:GetMetricData",
          "cloudwatch:ListMetrics",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:GetLogEvents",
          "logs:FilterLogEvents",
          "logs:StartQuery",
          "logs:GetQueryResults",
          "states:DescribeExecution",
          "states:GetExecutionHistory",
          "states:ListExecutions",
          "states:DescribeStateMachine",
          "states:ListStateMachines",
          "lambda:InvokeFunction",
          "lambda:ListFunctions",
        ],
        resources: ["*"],
      }),
    );

    new cdk.CfnOutput(this, "CrossAccountRoleArn", {
      value: role.roleArn,
      description: "ARN of the OpenClaw cross-account role (provide to the bot config)",
    });
  }
}
