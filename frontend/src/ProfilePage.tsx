import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EditIcon from "@mui/icons-material/Edit";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

export default function ProfilePage() {
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(["ラーメン", "うどん", "そば", "ご飯物"]);
  const [notice, setNotice] = useState<string | null>(null);
  const addableGenres = useMemo(
    () => ["カレー", "定食", "焼肉", "寿司"].filter((genre) => !favoriteGenres.includes(genre)),
    [favoriteGenres],
  );

  const handleAddGenre = () => {
    const nextGenre = addableGenres[0];
    if (!nextGenre) {
      setNotice("追加できるジャンルはありません。");
      return;
    }
    setFavoriteGenres((prev) => [...prev, nextGenre]);
    setNotice(`${nextGenre} を追加しました。`);
  };

  const handleRemoveGenre = (genre: string) => {
    setFavoriteGenres((prev) => prev.filter((item) => item !== genre));
    setNotice(`${genre} を削除しました。`);
  };

  return (
    <Box component="main" sx={{ fontFamily: "sans-serif", maxWidth: 980, mx: "auto", px: 2, py: 3 }}>
      <title>プロフィール | 食ジャンMAP</title>
      <Button
        component={Link}
        to="/"
        startIcon={<ArrowBackIcon />}
        sx={{ color: "text.secondary", mb: 2, p: 0, justifyContent: "flex-start" }}
      >
        ホームに戻る
      </Button>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems={{ xs: "flex-start", md: "center" }}>
            <Stack direction="row" spacing={2} sx={{ flex: 1, width: "100%" }}>
              <Avatar sx={{ width: 88, height: 88, bgcolor: "#f3e8c9", color: "#1f2937", fontSize: 40 }}>👨🏻</Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: "1.9rem", md: "2.2rem" } }}>
                  山田 太郎
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.2 }}>
                  @misaki_gourmet・食通レベル: 12
                </Typography>
                <Button variant="outlined" startIcon={<SettingsIcon />} sx={{ mt: 1.6 }}>
                  アカウント設定
                </Button>
              </Box>
            </Stack>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />
            <Divider sx={{ width: "100%", display: { xs: "block", md: "none" } }} />

            <Stack direction="row" spacing={4} sx={{ px: { md: 1 }, alignSelf: { xs: "stretch", md: "center" } }}>
              <Box textAlign="center">
                <Typography sx={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>24</Typography>
                <Typography variant="body2" color="text.secondary">
                  レポート
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography sx={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>156</Typography>
                <Typography variant="body2" color="text.secondary">
                  お気に入り
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Box
        sx={{
          mt: 2.5,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.05fr 1fr" },
          gap: 2,
        }}
      >
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <RestaurantIcon color="warning" fontSize="small" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  お気に入りジャンル
                </Typography>
              </Stack>
              <Button size="small" startIcon={<EditIcon />} sx={{ color: "warning.main" }}>
                編集
              </Button>
            </Stack>

            <Typography color="text.secondary" sx={{ mt: 1.4, mb: 1.8 }}>
              診断結果に優先的に表示されるジャンルです。
            </Typography>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {favoriteGenres.map((genre) => (
                <Chip
                  key={genre}
                  label={genre}
                  onDelete={() => handleRemoveGenre(genre)}
                  color="warning"
                  variant="outlined"
                />
              ))}
              <Button variant="outlined" onClick={handleAddGenre}>
                + 追加
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    お気に入り一覧
                  </Typography>
                  <Typography color="text.secondary">保存した店舗を確認する</Typography>
                </Box>
                <Avatar sx={{ bgcolor: "#f5f5f4", color: "text.secondary" }}>
                  <FavoriteBorderIcon />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    マイレポート一覧
                  </Typography>
                  <Typography color="text.secondary">過去の診断・訪問履歴</Typography>
                </Box>
                <Avatar sx={{ bgcolor: "#f5f5f4", color: "text.secondary" }}>
                  <DescriptionOutlinedIcon />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      {notice && (
        <Typography sx={{ mt: 2, color: "text.secondary" }}>
          {notice}
        </Typography>
      )}
    </Box>
  );
}
