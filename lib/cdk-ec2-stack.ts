import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class CdkEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC with public subnets
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 28, // 24
        },
      ],
    });

    // Create a security group (no inbound rules needed for SSM)
    const securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      description: "Security group for EC2 instance with SSM access",
      allowAllOutbound: true,
    });

    // Create IAM role for EC2 instance (enables Session Manager and Bedrock access)
    const role = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore",
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockFullAccess"),
      ],
    });

    // Create the EC2 instance
    const instance = new ec2.Instance(this, "clawInstance", {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.SMALL,
      ),
      machineImage: ec2.MachineImage.genericLinux({
        "us-west-2": "ami-0320940581663281e", // Amazon Linux 2023 - fixed version
      }),
      securityGroup,
      role,
      associatePublicIpAddress: true,
    });

    // Prevent the instance from being deleted or replaced by CloudFormation
    const cfnInstance = instance.node.defaultChild as cdk.CfnResource;
    cfnInstance.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN, {
      applyToUpdateReplacePolicy: true,
    });

    // Output the instance public IP and instance ID
    new cdk.CfnOutput(this, "InstanceId", {
      value: instance.instanceId,
      description: "EC2 Instance ID",
    });

    new cdk.CfnOutput(this, "InstancePublicIp", {
      value: instance.instancePublicIp,
      description: "EC2 Instance Public IP",
    });

    new cdk.CfnOutput(this, "SSMConnectCommand", {
      value: `aws ssm start-session --target ${instance.instanceId} --region ${this.region}`,
      description: "Command to connect via Session Manager",
    });

    // OpenClaw Dev instance for the dev team
    const devInstance = new ec2.Instance(this, "clawInstanceDev", {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.SMALL,
      ),
      machineImage: ec2.MachineImage.genericLinux({
        "us-west-2": "ami-0320940581663281e", // Amazon Linux 2023 - fixed version
      }),
      securityGroup,
      role,
      associatePublicIpAddress: true,
    });

    // Prevent the dev instance from being deleted or replaced by CloudFormation
    const cfnDevInstance = devInstance.node.defaultChild as cdk.CfnResource;
    cfnDevInstance.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN, {
      applyToUpdateReplacePolicy: true,
    });

    new cdk.CfnOutput(this, "DevInstanceId", {
      value: devInstance.instanceId,
      description: "OpenClaw Dev EC2 Instance ID",
    });

    new cdk.CfnOutput(this, "DevInstancePublicIp", {
      value: devInstance.instancePublicIp,
      description: "OpenClaw Dev EC2 Instance Public IP",
    });

    new cdk.CfnOutput(this, "DevSSMConnectCommand", {
      value: `aws ssm start-session --target ${devInstance.instanceId} --region ${this.region}`,
      description:
        "Command to connect to OpenClaw Dev instance via Session Manager",
    });
  }
}
