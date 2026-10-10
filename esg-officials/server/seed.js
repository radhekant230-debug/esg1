const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

const User = require("./models/User");
const Project = require("./models/Project");
const Task = require("./models/Task");
const ProjectUpdate = require("./models/ProjectUpdate");
const Approval = require("./models/Approval");
const Document = require("./models/Document");
const Message = require("./models/Message");
const Notification = require("./models/Notification");
const ActivityLog = require("./models/ActivityLog");
const OTP = require("./models/OTP");

dotenv.config();

const currentYear = new Date().getFullYear();

const seedDatabase = async () => {
  try {
    // ==========================================
    // CONNECT DATABASE
    // ==========================================

    await mongoose.connect(process.env.MONGO_URI);

    console.log("\n==========================================");
    console.log("MongoDB connected");
    console.log("==========================================\n");

    // ==========================================
    // CLEAR EXISTING DATA
    // ==========================================

    await Promise.all([
      User.deleteMany(),
      Project.deleteMany(),
      Task.deleteMany(),
      ProjectUpdate.deleteMany(),
      Approval.deleteMany(),
      Document.deleteMany(),
      Message.deleteMany(),
      Notification.deleteMany(),
      ActivityLog.deleteMany(),
      OTP.deleteMany(),
    ]);

    console.log("Existing portal data cleared.\n");

    // ==========================================
    // PASSWORD
    // ==========================================

    const password = await bcrypt.hash(
      "password123",
      10
    );

    // ==========================================
    // CREATE USERS
    // ==========================================

    const admin = await User.create({
      name: "ESG Admin",
      email: "admin@esgofficial.com",
      password,
      role: "admin",
      isVerified: true,
      isActive: true,
    });

    const manager1 = await User.create({
      name: "Rahul Sharma",
      email: "rahul.manager@esgofficial.com",
      password,
      role: "manager",
      isVerified: true,
      isActive: true,
    });

    const manager2 = await User.create({
      name: "Priya Singh",
      email: "priya.manager@esgofficial.com",
      password,
      role: "manager",
      isVerified: true,
      isActive: true,
    });

    /*
     * We explicitly provide clientId because the seed uses
     * database insertion directly and should not depend on
     * the User pre-save Client ID generator.
     */

    const client1 = await User.create({
      name: "Aarav Mehta",
      email: "aarav@client.com",
      password,
      role: "client",
      clientId: `CLI-${currentYear}-0001`,
      companyName: "Aarav Technologies",
      phone: "9876543210",
      assignedManager: manager1._id,
      isVerified: true,
      isActive: true,
    });

    const client2 = await User.create({
      name: "Neha Kapoor",
      email: "neha@client.com",
      password,
      role: "client",
      clientId: `CLI-${currentYear}-0002`,
      companyName: "Kapoor Enterprises",
      phone: "9876543211",
      assignedManager: manager2._id,
      isVerified: true,
      isActive: true,
    });

    const client3 = await User.create({
      name: "Rohan Verma",
      email: "rohan@client.com",
      password,
      role: "client",
      clientId: `CLI-${currentYear}-0003`,
      companyName: "Verma Solutions",
      phone: "9876543212",
      assignedManager: manager1._id,
      isVerified: true,
      isActive: true,
    });

    console.log("Users created.");

    // ==========================================
    // CREATE PROJECTS
    // ==========================================

    /*
     * Explicit projectId is used so this seed doesn't depend
     * on the Project pre-save hook.
     */

    const project1 = await Project.create({
      projectId: `PRJ-${currentYear}-0001`,
      name: "Corporate Website Development",
      description:
        "Complete development of a modern corporate website with responsive design, CMS integration and deployment.",
      client: client1._id,
      assignedManager: manager1._id,
      startDate: new Date(currentYear, 0, 15),
      deadline: new Date(currentYear, 3, 30),
      status: "In Progress",
      priority: "High",
      progress: 65,
      createdBy: admin._id,
    });

    const project2 = await Project.create({
      projectId: `PRJ-${currentYear}-0002`,
      name: "Digital Marketing Platform",
      description:
        "Development of a centralized digital marketing platform for campaign management and analytics.",
      client: client2._id,
      assignedManager: manager2._id,
      startDate: new Date(currentYear, 1, 1),
      deadline: new Date(currentYear, 5, 15),
      status: "Planning",
      priority: "Medium",
      progress: 25,
      createdBy: admin._id,
    });

    const project3 = await Project.create({
      projectId: `PRJ-${currentYear}-0003`,
      name: "Business Analytics Dashboard",
      description:
        "Interactive analytics dashboard for monitoring business KPIs, reports and operational performance.",
      client: client3._id,
      assignedManager: manager1._id,
      startDate: new Date(currentYear, 0, 20),
      deadline: new Date(currentYear, 4, 30),
      status: "Waiting for Client",
      priority: "Urgent",
      progress: 45,
      createdBy: admin._id,
    });

    console.log("Projects created.");

    // ==========================================
    // CREATE TASKS
    // ==========================================

    const task1 = await Task.create({
      taskId: `TSK-${currentYear}-0001`,
      title: "Design Homepage",
      description:
        "Create the responsive homepage UI according to the approved design requirements.",
      project: project1._id,
      assignedManager: manager1._id,
      status: "Completed",
      priority: "High",
      dueDate: new Date(currentYear, 1, 15),
      progress: 100,
      createdBy: manager1._id,
    });

    const task2 = await Task.create({
      taskId: `TSK-${currentYear}-0002`,
      title: "Develop Authentication",
      description:
        "Implement secure client authentication and authorization functionality.",
      project: project1._id,
      assignedManager: manager1._id,
      status: "In Progress",
      priority: "Urgent",
      dueDate: new Date(currentYear, 2, 15),
      progress: 70,
      createdBy: manager1._id,
    });

    const task3 = await Task.create({
      taskId: `TSK-${currentYear}-0003`,
      title: "Prepare Marketing Dashboard",
      description:
        "Develop the initial dashboard structure and analytics components.",
      project: project2._id,
      assignedManager: manager2._id,
      status: "Review",
      priority: "Medium",
      dueDate: new Date(currentYear, 3, 20),
      progress: 80,
      createdBy: manager2._id,
    });

    const task4 = await Task.create({
      taskId: `TSK-${currentYear}-0004`,
      title: "Client Data Integration",
      description:
        "Integrate the approved client data sources into the analytics dashboard.",
      project: project3._id,
      assignedManager: manager1._id,
      status: "Waiting for Approval",
      priority: "High",
      dueDate: new Date(currentYear, 4, 10),
      progress: 60,
      createdBy: manager1._id,
    });

    console.log("Tasks created.");

    // ==========================================
    // CREATE PROJECT UPDATES
    // ==========================================

    const update1 = await ProjectUpdate.create({
      updateId: `UPD-${currentYear}-0001`,
      project: project1._id,
      task: task2._id,
      title: "Authentication Development Update",
      description:
        "Authentication module development is progressing well. Login, registration and OTP verification have been implemented.",
      progress: 70,
      status: "Update",
      createdBy: manager1._id,
      clientApprovalRequired: false,
    });

    const update2 = await ProjectUpdate.create({
      updateId: `UPD-${currentYear}-0002`,
      project: project1._id,
      task: task1._id,
      title: "Homepage Completed",
      description:
        "Homepage design and responsive implementation have been completed and are ready for client review.",
      progress: 100,
      status: "Waiting for Approval",
      createdBy: manager1._id,
      clientApprovalRequired: true,
    });

    const update3 = await ProjectUpdate.create({
      updateId: `UPD-${currentYear}-0003`,
      project: project2._id,
      task: task3._id,
      title: "Dashboard Ready for Review",
      description:
        "The first version of the marketing analytics dashboard is ready for review.",
      progress: 80,
      status: "Waiting for Approval",
      createdBy: manager2._id,
      clientApprovalRequired: true,
    });

    const update4 = await ProjectUpdate.create({
      updateId: `UPD-${currentYear}-0004`,
      project: project3._id,
      task: task4._id,
      title: "Data Integration Progress",
      description:
        "Initial data integration has been completed. Client approval is required before continuing with the next phase.",
      progress: 60,
      status: "Waiting for Approval",
      createdBy: manager1._id,
      clientApprovalRequired: true,
    });

    console.log("Project updates created.");

    // ==========================================
    // CREATE APPROVALS
    // ==========================================

    const approval1 = await Approval.create({
      approvalId: `APR-${currentYear}-0001`,
      project: project1._id,
      task: task1._id,
      update: update2._id,
      client: client1._id,
      requestedBy: manager1._id,
      status: "Pending",
      clientComment: "",
      reviewedAt: null,
    });

    const approval2 = await Approval.create({
      approvalId: `APR-${currentYear}-0002`,
      project: project2._id,
      task: task3._id,
      update: update3._id,
      client: client2._id,
      requestedBy: manager2._id,
      status: "Approved",
      clientComment:
        "The dashboard looks good. Approved to continue.",
      reviewedAt: new Date(),
    });

    const approval3 = await Approval.create({
      approvalId: `APR-${currentYear}-0003`,
      project: project3._id,
      task: task4._id,
      update: update4._id,
      client: client3._id,
      requestedBy: manager1._id,
      status: "Rejected",
      clientComment:
        "Please revise the data presentation before continuing.",
      reviewedAt: new Date(),
    });

    console.log("Approvals created.");

    // ==========================================
    // CREATE DOCUMENTS
    // ==========================================

    const document1 = await Document.create({
      documentId: `DOC-${currentYear}-0001`,
      project: project1._id,
      task: task1._id,
      uploadedBy: manager1._id,
      name: "Project Requirements.pdf",
      url: "https://example.com/documents/project-requirements.pdf",
      publicId: "",
      fileType: "PDF",
      fileSize: 245760,
      description:
        "Initial project requirements and specifications.",
    });

    const document2 = await Document.create({
      documentId: `DOC-${currentYear}-0002`,
      project: project1._id,
      task: task2._id,
      uploadedBy: manager1._id,
      name: "Authentication Specification.pdf",
      url: "https://example.com/documents/authentication-specification.pdf",
      publicId: "",
      fileType: "PDF",
      fileSize: 184320,
      description:
        "Authentication and security requirements.",
    });

    const document3 = await Document.create({
      documentId: `DOC-${currentYear}-0003`,
      project: project2._id,
      task: task3._id,
      uploadedBy: manager2._id,
      name: "Marketing Dashboard Report.pdf",
      url: "https://example.com/documents/marketing-dashboard-report.pdf",
      publicId: "",
      fileType: "PDF",
      fileSize: 320000,
      description:
        "Marketing dashboard progress report.",
    });

    const document4 = await Document.create({
      documentId: `DOC-${currentYear}-0004`,
      project: project3._id,
      task: null,
      uploadedBy: manager1._id,
      name: "Analytics Requirements.pdf",
      url: "https://example.com/documents/analytics-requirements.pdf",
      publicId: "",
      fileType: "PDF",
      fileSize: 278000,
      description:
        "Business analytics dashboard requirements.",
    });

    console.log("Documents created.");

    // ==========================================
    // CREATE MESSAGES
    // ==========================================

    const message1 = await Message.create({
      conversationId: `project-${project1._id}`,
      sender: client1._id,
      receiver: manager1._id,
      project: project1._id,
      message:
        "Hi Rahul, can you provide an update on the authentication module?",
      attachments: [],
      isRead: true,
      readAt: new Date(),
    });

    const message2 = await Message.create({
      conversationId: `project-${project1._id}`,
      sender: manager1._id,
      receiver: client1._id,
      project: project1._id,
      message:
        "Sure. The authentication module is around 70% complete. OTP verification is also being tested.",
      attachments: [],
      isRead: false,
      readAt: null,
    });

    const message3 = await Message.create({
      conversationId: `project-${project2._id}`,
      sender: client2._id,
      receiver: manager2._id,
      project: project2._id,
      message:
        "The dashboard looks good. I have approved the current update.",
      attachments: [],
      isRead: true,
      readAt: new Date(),
    });

    const message4 = await Message.create({
      conversationId: `project-${project3._id}`,
      sender: manager1._id,
      receiver: client3._id,
      project: project3._id,
      message:
        "The data integration is ready for your review and approval.",
      attachments: [],
      isRead: false,
      readAt: null,
    });

    console.log("Messages created.");

    // ==========================================
    // CREATE NOTIFICATIONS
    // ==========================================

    const notification1 = await Notification.create({
      notificationId: `NOT-${currentYear}-0001`,
      recipient: client1._id,
      type: "approval",
      title: "Approval Required",
      message:
        "A new project update is waiting for your approval.",
      project: project1._id,
      task: task1._id,
      approval: approval1._id,
      isRead: false,
      readAt: null,
    });

    const notification2 = await Notification.create({
      notificationId: `NOT-${currentYear}-0002`,
      recipient: client2._id,
      type: "approval",
      title: "Update Approved",
      message:
        "Your project update has been approved successfully.",
      project: project2._id,
      task: task3._id,
      approval: approval2._id,
      isRead: true,
      readAt: new Date(),
    });

    const notification3 = await Notification.create({
      notificationId: `NOT-${currentYear}-0003`,
      recipient: client3._id,
      type: "approval",
      title: "Approval Rejected",
      message:
        "Your project update requires changes before approval.",
      project: project3._id,
      task: task4._id,
      approval: approval3._id,
      isRead: false,
      readAt: null,
    });

    const notification4 = await Notification.create({
      notificationId: `NOT-${currentYear}-0004`,
      recipient: client1._id,
      type: "message",
      title: "New Message",
      message:
        "You have received a new message from your project manager.",
      project: project1._id,
      task: null,
      approval: null,
      isRead: false,
      readAt: null,
    });

    const notification5 = await Notification.create({
      notificationId: `NOT-${currentYear}-0005`,
      recipient: client2._id,
      type: "document",
      title: "New Document",
      message:
        "A new project document has been uploaded.",
      project: project2._id,
      task: task3._id,
      approval: null,
      isRead: true,
      readAt: new Date(),
    });

    console.log("Notifications created.");

    // ==========================================
    // CREATE ACTIVITY LOGS
    // ==========================================

    await ActivityLog.create({
      user: admin._id,
      action: "Created Project",
      entityType: "Project",
      entityId: project1._id,
      description:
        "Admin created the Corporate Website Development project.",
      metadata: {
        projectId: project1.projectId,
      },
    });

    await ActivityLog.create({
      user: manager1._id,
      action: "Created Task",
      entityType: "Task",
      entityId: task2._id,
      description:
        "Manager created the Authentication Development task.",
      metadata: {
        taskId: task2.taskId,
      },
    });

    await ActivityLog.create({
      user: manager1._id,
      action: "Posted Project Update",
      entityType: "ProjectUpdate",
      entityId: update2._id,
      description:
        "Manager posted a project update requesting client approval.",
      metadata: {
        updateId: update2.updateId,
      },
    });

    await ActivityLog.create({
      user: client1._id,
      action: "Received Approval Request",
      entityType: "Approval",
      entityId: approval1._id,
      description:
        "Client received an approval request for the homepage update.",
      metadata: {
        approvalId: approval1.approvalId,
      },
    });

    await ActivityLog.create({
      user: manager1._id,
      action: "Uploaded Document",
      entityType: "Document",
      entityId: document1._id,
      description:
        "Manager uploaded the project requirements document.",
      metadata: {
        documentId: document1.documentId,
      },
    });

    await ActivityLog.create({
      user: client1._id,
      action: "Sent Message",
      entityType: "Message",
      entityId: message1._id,
      description:
        "Client sent a message to the project manager.",
      metadata: {
        projectId: project1.projectId,
      },
    });

    await ActivityLog.create({
      user: client1._id,
      action: "Received Notification",
      entityType: "Notification",
      entityId: notification1._id,
      description:
        "Client received an approval notification.",
      metadata: {
        notificationId: notification1.notificationId,
      },
    });

    console.log("Activity logs created.");

    // ==========================================
    // SUMMARY
    // ==========================================

    console.log("\n==========================================");
    console.log("DATABASE SEEDED SUCCESSFULLY");
    console.log("==========================================\n");

    console.log("ADMIN");
    console.log("------------------------------------------");
    console.log("Email:    admin@esgofficial.com");
    console.log("Password: password123\n");

    console.log("MANAGERS");
    console.log("------------------------------------------");
    console.log("Email:    rahul.manager@esgofficial.com");
    console.log("Email:    priya.manager@esgofficial.com");
    console.log("Password: password123\n");

    console.log("CLIENTS");
    console.log("------------------------------------------");
    console.log(
      "Client 1: aarav@client.com | CLI-" +
        currentYear +
        "-0001"
    );
    console.log(
      "Client 2: neha@client.com  | CLI-" +
        currentYear +
        "-0002"
    );
    console.log(
      "Client 3: rohan@client.com | CLI-" +
        currentYear +
        "-0003"
    );
    console.log("Password: password123\n");

    console.log("DATA CREATED");
    console.log("------------------------------------------");
    console.log("Users:          6");
    console.log("Projects:       3");
    console.log("Tasks:          4");
    console.log("Updates:        4");
    console.log("Approvals:      3");
    console.log("Documents:      4");
    console.log("Messages:       4");
    console.log("Notifications:  5");
    console.log("Activity Logs:  7");
    console.log("==========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("\n==========================================");
    console.error("SEED ERROR");
    console.error("==========================================");
    console.error(error);
    process.exit(1);
  }
};

seedDatabase();