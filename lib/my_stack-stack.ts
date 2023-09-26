
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';


export class MyStackStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC - Will creat VPC, subnets, IGW, Public RT & Routes, 
    // Allow Dynamic IP, EIP, NATGW, Private RT, Destination for NATGW,
    // 
    const vpc = new ec2.Vpc(this, 'SarvanVPC', {
      cidr: '10.20.0.0/16',
      vpcName: 'SarvanVPC',
    });

    
    const asg = new autoscaling.AutoScalingGroup(this, 'ASGSarvan', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage(),
      vpcSubnets: vpc.selectSubnets({subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}),
    });


    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALBSarvan', {
          vpc,
          internetFacing: true,
          vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
    });

    
    const listener = alb.addListener('Listener', {
      port: 80,
    });


    listener.addTargets('Target', {
      port: 80,
      targets: [asg]
    });

    listener.connections.allowDefaultPortFromAnyIpv4('Open to the world');
    
    
    const dbsg = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
          vpc: vpc,
          allowAllOutbound: true,
          description: id + ' Database',
          securityGroupName: 'SarvanRDSSG',
    });


    dbsg.addIngressRule(ec2.Peer.ipv4('0.0.0.0/0'), ec2.Port.tcp(3306), 'MySQL traffic');

    const UserName = 'admin'
    
    const rdsSecret = new secretsmanager.Secret(this, 'RDSSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: UserName }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'metro123',
        // excludeCharacters: "\"@/\\ '",
        passwordLength: 30,
      },
    });


    // Create an RDS instance
    new rds.DatabaseInstance(this, 'MyRDSInstance', {
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_5_7_37 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      vpc,
      securityGroups: [dbsg],
      multiAz: true,
      allocatedStorage: 20,
      storageType: rds.StorageType.GP2,
      // credentials: mysqlCredentials,
      credentials: {
        username: UserName,
        password: rdsSecret.secretValue,
      },
    });
    
    
    
    


  }
}
