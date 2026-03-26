"use client";

import { Create, useForm } from "@refinedev/antd";
import { Form, Input, InputNumber, Select } from "antd";

export default function EbayOrderCreate() {
  const { formProps, saveButtonProps } = useForm({});

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Order ID"
          name="order_id"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Buyer Username"
          name="buyer_username"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Item Title"
          name="item_title"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Total Price"
          name="total_price"
          rules={[{ required: true }]}
        >
          <InputNumber min={0} precision={2} prefix="$" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          label="Status"
          name="status"
          initialValue="pending"
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { value: "pending", label: "Pending" },
              { value: "shipped", label: "Shipped" },
              { value: "delivered", label: "Delivered" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        </Form.Item>
      </Form>
    </Create>
  );
}
