import React, { useState, useEffect } from 'react';
import { useDatabase } from '../services/DatabaseServiceContext';
import { AutomaticTask, TaskPriority, AutomaticTaskStatus, User } from '../types';
import { Button, Card, Table, Badge, Select, Input, DatePicker, message, Modal, Form } from 'antd';
import { PlusOutlined, CheckOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;

const AutomaticTasksPage: React.FC = () => {
  const database = useDatabase();
  const [tasks, setTasks] = useState<AutomaticTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    
    // Set up periodic check for automatic task assignment
    const checkInterval = setInterval(async () => {
      try {
        await database.checkAndAssignAutomaticTasks();
        // Reload data after assignment check
        loadData();
      } catch (error) {
        console.error('Error checking automatic tasks:', error);
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(checkInterval);
  }, [database]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tasksData, usersData] = await Promise.all([
        database.getAutomaticTasks(),
        database.getUsers(),
      ]);
      setTasks(tasksData);
      setUsers(usersData);
    } catch (error) {
      message.error('Failed to load data');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (values: any) => {
    try {
      setLoading(true);
      await database.createAutomaticTask({
        taskTitle: values.title,
        taskDescription: values.description,
        priority: values.priority,
        teamId: values.teamId,
        dueDate: values.dueDate?.toISOString(),
      });
      message.success('Task created successfully');
      setIsModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error('Failed to create task');
      console.error('Error creating task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTask = async (taskId: string, userId: string) => {
    try {
      setLoading(true);
      await database.assignAutomaticTask(taskId, userId, 'system');
      message.success('Task assigned successfully');
      loadData();
    } catch (error) {
      message.error('Failed to assign task');
      console.error('Error assigning task:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'taskTitle',
      key: 'taskTitle',
    },
    {
      title: 'Description',
      dataIndex: 'taskDescription',
      key: 'taskDescription',
      ellipsis: true,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: TaskPriority) => (
        <Badge
          status={
            priority === 'high'
              ? 'error'
              : priority === 'medium'
              ? 'warning'
              : 'success'
          }
          text={priority.charAt(0).toUpperCase() + priority.slice(1)}
        />
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: AutomaticTaskStatus) => (
        <Badge
          status={status === 'assigned' ? 'success' : 'processing'}
          text={status.charAt(0).toUpperCase() + status.slice(1)}
        />
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: AutomaticTask) => (
        <Select
          placeholder="Assign to"
          style={{ width: 200 }}
          onChange={(value) => handleAssignTask(record.taskId, value)}
          disabled={record.status === 'assigned'}
        >
          {users.map((user) => (
            <Option key={user.id} value={user.id}>
              {user.name}
            </Option>
          ))}
        </Select>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title="Automatic Tasks"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalVisible(true)}
          >
            Create Task
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="taskId"
          loading={loading}
        />
      </Card>

      <Modal
        title="Create Automatic Task"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTask}
        >
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please input the task title!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please input the task description!' }]}
          >
            <Input.TextArea />
          </Form.Item>

          <Form.Item
            name="priority"
            label="Priority"
            rules={[{ required: true, message: 'Please select the task priority!' }]}
          >
            <Select>
              <Option value="high">High</Option>
              <Option value="medium">Medium</Option>
              <Option value="low">Low</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="dueDate"
            label="Due Date"
            rules={[{ required: true, message: 'Please select the due date!' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="teamId"
            label="Team"
            rules={[{ required: true, message: 'Please select a team!' }]}
          >
            <Select>
              {users
                .filter((user) => user.role === 'team_lead')
                .map((user) => (
                  <Option key={user.id} value={user.teamId}>
                    {user.teamName}
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Create
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AutomaticTasksPage; 