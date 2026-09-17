import { PictureOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Input, Tabs, Typography } from "antd";
import { useState } from "react";

const MAX_BACKGROUND_IMAGE_BYTES = 2 * 1024 * 1024;

export const dashboardBackgroundAssets = [
  { id: "blue-cyan", label: "蓝色光束", src: "/images/dashboard-backgrounds/blue-cyan.png" },
  { id: "blue-night", label: "深蓝光影", src: "/images/dashboard-backgrounds/blue-night.png" },
  { id: "orange-gold", label: "橙色光晕", src: "/images/dashboard-backgrounds/orange-gold.png" },
  { id: "coral", label: "珊瑚暖色", src: "/images/dashboard-backgrounds/coral.png" },
  { id: "ice", label: "冰蓝雾光", src: "/images/dashboard-backgrounds/ice.png" },
  { id: "purple", label: "深紫光影", src: "/images/dashboard-backgrounds/purple.png" },
] as const;

interface DashboardBackgroundPickerProps {
  readonly value: string;
  readonly onSelect: (image: string) => void;
  readonly onClear: () => void;
}

const readLocalImage = (file: File, onSelect: (image: string) => void, onError: (message: string) => void) => {
  if (!file.type.startsWith("image/")) {
    onError("请选择图片文件");
    return;
  }
  if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
    onError("图片不能超过 2 MB");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === "string" && onSelect(reader.result);
  reader.onerror = () => onError("图片读取失败");
  reader.readAsDataURL(file);
};

export const DashboardBackgroundPicker = ({ value, onSelect, onClear }: DashboardBackgroundPickerProps) => {
  const [activeTab, setActiveTab] = useState("library");
  const [urlDraft, setUrlDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectImage = (image: string) => {
    setError(null);
    onSelect(image);
  };

  const useUrl = () => {
    const url = urlDraft.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("请输入 http 或 https 图片地址");
      return;
    }
    selectImage(url);
  };

  return (
    <div className="dashboard-background-picker">
      <Tabs
        activeKey={activeTab}
        items={[
          {
            key: "library",
            label: "使用素材",
            children: <div className="dashboard-background-picker__library">
              <Typography.Text type="secondary">图片背景</Typography.Text>
              <div className="dashboard-background-picker__asset-grid">
                {dashboardBackgroundAssets.map((asset) => (
                  <button
                    key={asset.id}
                    aria-label={`使用${asset.label}`}
                    className={`dashboard-background-picker__asset${value === asset.src ? " is-selected" : ""}`}
                    type="button"
                    onClick={() => selectImage(asset.src)}
                  >
                    <img alt="" src={asset.src} />
                  </button>
                ))}
              </div>
            </div>,
          },
          {
            key: "custom",
            label: "自定义图片",
            children: <div className="dashboard-background-picker__custom">
              <label className="dashboard-background-picker__upload">
                <Button icon={<UploadOutlined />} type="primary" ghost>上传本地图片</Button>
                <span>只支持 jpg, jpeg, png, gif, svg 格式，最大 2MB</span>
                <input
                  aria-label="上传仪表板背景图片"
                  accept="image/jpeg,image/png,image/gif,image/svg+xml"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) readLocalImage(file, selectImage, setError);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <span className="dashboard-background-picker__url-label">或 通过图片链接上传</span>
              <div className="dashboard-background-picker__url-row">
                <Input aria-label="仪表板背景图片地址" placeholder="请输入图片网址" value={urlDraft} onChange={(event) => setUrlDraft(event.target.value)} onPressEnter={useUrl} />
                <Button disabled={urlDraft.trim().length === 0} onClick={useUrl}>使用</Button>
              </div>
              {error && <Typography.Text className="dashboard-background-picker__error" type="danger">{error}</Typography.Text>}
            </div>,
          },
        ]}
        onChange={setActiveTab}
      />
      <div className="dashboard-background-picker__footer">
        <Button type="link" onClick={onClear}>清空图片</Button>
      </div>
    </div>
  );
};

export const DashboardBackgroundThumbnail = ({ value }: { readonly value: string }) => (
  <span className="dashboard-settings__background-thumbnail" aria-hidden="true">
    {value ? <img alt="" src={value} /> : <PictureOutlined />}
  </span>
);
