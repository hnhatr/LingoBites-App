import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import type {TodayFeatures} from '../logic/todayFeatures';

export type AddLessonKind = 'create' | 'library' | 'course';

type AddLessonOption = {
  kind: AddLessonKind;
  icon: HandoffIconName;
  shortVi: string;
  captionVi: string;
  titleVi: string;
  descriptionVi: string;
};

const OPTIONS: readonly AddLessonOption[] = [
  {
    kind: 'create',
    icon: 'edit',
    shortVi: 'Tạo bài',
    captionVi: 'Ảnh, chữ, video',
    titleVi: 'Tạo bài mới',
    descriptionVi: 'Chụp ảnh, dán đoạn chữ hoặc link YouTube để tạo bài',
  },
  {
    kind: 'library',
    icon: 'menu_book',
    shortVi: 'Thư viện',
    captionVi: 'Bài có sẵn',
    titleVi: 'Chọn từ thư viện',
    descriptionVi: 'Chọn bài có sẵn, tải về để học cả khi offline',
  },
  {
    kind: 'course',
    icon: 'school',
    shortVi: 'Khoá học',
    captionVi: 'Theo cấp độ',
    titleVi: 'Chọn từ khoá học',
    descriptionVi: 'Chọn bài tiếp theo trong khoá học theo cấp độ',
  },
];

/** The ways to add a lesson the admin left on (`add_lesson.*`). */
export function enabledAddLessonOptions(
  features: TodayFeatures,
): readonly AddLessonOption[] {
  return OPTIONS.filter(option => features[`add_lesson.${option.kind}`]);
}

type GridProps = {
  options: readonly AddLessonOption[];
  onSelect: (kind: AddLessonKind) => void;
};

/** Three compact tiles, shown where the plan has minutes to spare. */
export function AddLessonGrid({options, onSelect}: GridProps) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.grid}>
      {options.map(option => (
        <Pressable
          accessibilityHint={option.descriptionVi}
          accessibilityLabel={option.titleVi}
          accessibilityRole="button"
          key={option.kind}
          onPress={() => onSelect(option.kind)}
          style={({pressed}) => [
            themedStyles.tile,
            pressed && themedStyles.pressed,
          ]}
          testID={`add-lesson-${option.kind}`}
        >
          <View style={themedStyles.tileIcon}>
            <MaterialIcon
              color={theme.colors.primary}
              name={option.icon}
              size={20}
            />
          </View>
          <AppText variant="label">{option.shortVi}</AppText>
          <AppText color="secondary" style={styles.centered} variant="caption">
            {option.captionVi}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

type ListProps = GridProps & {testIDPrefix?: string};

/** Full-width rows with a description: the sheet and the empty state. */
export function AddLessonList({
  options,
  onSelect,
  testIDPrefix = 'add-lesson-row',
}: ListProps) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.list}>
      {options.map(option => (
        <Pressable
          accessibilityHint={option.descriptionVi}
          accessibilityLabel={option.titleVi}
          accessibilityRole="button"
          key={option.kind}
          onPress={() => onSelect(option.kind)}
          style={({pressed}) => [
            themedStyles.row,
            pressed && themedStyles.pressed,
          ]}
          testID={
            option.kind === 'library' && testIDPrefix === 'today-empty'
              ? 'today-go-download'
              : `${testIDPrefix}-${option.kind}`
          }
        >
          <View style={themedStyles.rowIcon}>
            <MaterialIcon
              color={theme.colors.primary}
              name={option.icon}
              size={22}
            />
          </View>
          <View style={styles.rowCopy}>
            <AppText variant="h3">{option.titleVi}</AppText>
            <AppText color="secondary" variant="caption">
              {option.descriptionVi}
            </AppText>
          </View>
          <MaterialIcon
            color={theme.colors.primary}
            name="chevron_right"
            size={22}
          />
        </Pressable>
      ))}
    </View>
  );
}

type SheetProps = GridProps & {visible: boolean; onDismiss: () => void};

export function AddLessonSheet({
  visible,
  options,
  onSelect,
  onDismiss,
}: SheetProps) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  return (
    <Modal
      animationType="slide"
      onRequestClose={onDismiss}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityHint="Đóng bảng thêm bài học"
        accessibilityLabel="Đóng"
        onPress={onDismiss}
        style={themedStyles.backdrop}
      />
      <View style={themedStyles.sheet} testID="add-lesson-sheet">
        <AppText variant="h2">Thêm bài học</AppText>
        <AppText color="secondary" variant="caption">
          Chọn cách thêm bài vào kế hoạch hôm nay
        </AppText>
        <AddLessonList
          onSelect={kind => {
            onDismiss();
            onSelect(kind);
          }}
          options={options}
          testIDPrefix="add-lesson-sheet"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  list: {
    gap: 10,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: theme.colors.overlay,
      flex: 1,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    row: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      ...getStickerFace(theme, 3, 1.5),
      flexDirection: 'row',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
    rowIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.md,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    sheet: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      gap: theme.spacing.sm,
      marginTop: 'auto',
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    tile: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      flex: 1,
      gap: 4,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
    },
    tileIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.sm,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
  });
}
