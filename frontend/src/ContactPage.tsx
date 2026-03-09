import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

const SUBJECT_OPTIONS = [
  "アプリの使い方について",
  "バグ・不具合の報告",
  "機能改善の要望",
  "その他",
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setDoneMessage("未入力項目があります。");
      return;
    }

    // 今は保存API未接続のため、送信完了メッセージのみ表示
    setDoneMessage("お問い合わせを受け付けました。ありがとうございます。");
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        py: 3,
        px: 2,
        background:
          "radial-gradient(circle at 20% 20%, rgba(186,230,253,0.45), transparent 50%), radial-gradient(circle at 80% 25%, rgba(187,247,208,0.35), transparent 45%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
      }}
    >
      <Box sx={{ maxWidth: 980, mx: "auto" }}>
        <Button
          component={Link}
          to="/"
          startIcon={<ArrowBackIcon />}
          sx={{ color: "text.secondary", mb: 2, p: 0, justifyContent: "flex-start" }}
        >
          戻る
        </Button>

        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
          <SupportAgentRoundedIcon sx={{ color: "#22c55e" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            お問い合わせ
          </Typography>
        </Stack>

        <Card
          variant="outlined"
          sx={{
            maxWidth: 760,
            mx: "auto",
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
          }}
        >
          <Box
            sx={{
              height: 118,
              px: 3.5,
              display: "flex",
              alignItems: "flex-end",
              pb: 2,
              background:
                "linear-gradient(120deg, rgba(31,78,74,0.95) 0%, rgba(102,150,145,0.9) 70%, rgba(167,208,199,0.86) 100%)",
            }}
          >
            <Typography sx={{ color: "#fff", fontSize: "2rem", fontWeight: 700, letterSpacing: "0.02em" }}>
              お問い合わせフォーム
            </Typography>
          </Box>

          <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
            <Typography color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.8 }}>
              アプリに関するご質問やご要望、不具合の報告などがございましたら、以下のフォームよりお気軽にお問い合わせください。
            </Typography>

            <Box component="form" onSubmit={handleSubmit}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography sx={{ fontWeight: 700, mb: 0.7 }}>
                    お名前 <Box component="span" sx={{ color: "error.main" }}>*</Box>
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="山田太郎"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlinedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography sx={{ fontWeight: 700, mb: 0.7 }}>
                    メールアドレス <Box component="span" sx={{ color: "error.main" }}>*</Box>
                  </Typography>
                  <TextField
                    fullWidth
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailOutlinedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid size={12}>
                  <Typography sx={{ fontWeight: 700, mb: 0.7 }}>
                    お問い合わせ項目 <Box component="span" sx={{ color: "error.main" }}>*</Box>
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="選択してください"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CategoryOutlinedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  >
                    <MenuItem value="" disabled>
                      選択してください
                    </MenuItem>
                    {SUBJECT_OPTIONS.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid size={12}>
                  <Typography sx={{ fontWeight: 700, mb: 0.7 }}>
                    お問い合わせ内容 <Box component="span" sx={{ color: "error.main" }}>*</Box>
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={6}
                    placeholder="詳細な内容をご記入ください..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </Grid>
              </Grid>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                startIcon={<SendRoundedIcon />}
                sx={{
                  mt: 3,
                  py: 1.3,
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  background: "linear-gradient(90deg, #fb923c 0%, #f97316 100%)",
                }}
              >
                送信する
              </Button>
            </Box>

            {doneMessage && (
              <Alert severity={doneMessage.includes("ありがとうございます") ? "success" : "warning"} sx={{ mt: 2 }}>
                {doneMessage}
              </Alert>
            )}

            <Typography align="center" color="text.secondary" sx={{ mt: 2.5, fontSize: "0.88rem" }}>
              ※個人情報は
              <Box component="span" sx={{ color: "#16a34a", fontWeight: 700 }}>
                プライバシーポリシー
              </Box>
              に基づいて厳重に管理されます。
            </Typography>
          </CardContent>
        </Card>

        <Typography align="center" color="text.secondary" sx={{ mt: 3, fontSize: "0.88rem" }}>
          © 2024 Food Diagnostic App. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}
