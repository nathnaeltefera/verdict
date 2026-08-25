import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBills } from '../../../src/data/store';
import { Avatar } from '../../../src/ui/components/Avatar';
import { AppButton, Card, EmptyState, SectionLabel } from '../../../src/ui/components/base';
import { palette, radius, space, type as typo } from '../../../src/ui/theme';

export default function People() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getBill, addPerson, removePerson, roster } = useBills();
  const [name, setName] = useState('');
  const bill = getBill(String(id));

  if (!bill) {
    return (
      <View style={styles.centered}>
        <Text style={[typo.body, { color: palette.textSoft }]}>That bill is no longer here.</Text>
      </View>
    );
  }

  const submit = () => {
    if (!name.trim()) return;
    addPerson(bill.id, name);
    setName('');
  };

  const atTable = new Set(bill.people.map((p) => p.name.toLowerCase()));
  const suggestions = roster.filter((p) => !atTable.has(p.name.toLowerCase())).slice(0, 12);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]} keyboardShouldPersistTaps="handled">
        <Card>
          <SectionLabel>Add everyone at the table</SectionLabel>
          <View style={styles.inputRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={submit}
              placeholder="Name"
              placeholderTextColor={palette.textFaint}
              autoCapitalize="words"
              returnKeyType="done"
              style={[typo.body, styles.input]}
            />
            <Pressable
              onPress={submit}
              disabled={!name.trim()}
              style={[styles.add, !name.trim() && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel="Add person"
            >
              <Text style={styles.addText}>+</Text>
            </Pressable>
          </View>

          {suggestions.length > 0 ? (
            <>
              <SectionLabel style={{ marginTop: space.lg }}>People you’ve split with before</SectionLabel>
              <View style={styles.suggestions}>
                {suggestions.map((person) => (
                  <Pressable key={person.id} onPress={() => addPerson(bill.id, person.name)} style={styles.suggestion}>
                    <Avatar person={person} size={22} />
                    <Text style={[typo.small, { color: palette.text }]}>{person.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </Card>

        {bill.people.length === 0 ? (
          <EmptyState
            emoji="👋"
            title="Nobody yet"
            body="Add yourself first, then everyone else who ate. You can always add someone later."
          />
        ) : (
          <View>
            <SectionLabel>At the table · {bill.people.length}</SectionLabel>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {bill.people.map((person, index) => (
                <View key={person.id} style={[styles.person, index > 0 && styles.personDivider]}>
                  <Avatar person={person} size={40} />
                  <Text style={[typo.body, { flex: 1, color: palette.text }]} numberOfLines={1}>
                    {person.name}
                  </Text>
                  <Pressable
                    onPress={() => removePerson(bill.id, person.id)}
                    hitSlop={10}
                    accessibilityLabel={`Remove ${person.name}`}
                  >
                    <Text style={[typo.small, { color: palette.textFaint }]}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md }]}>
        <AppButton
          label={bill.people.length ? 'Next — who had what' : 'Add someone to continue'}
          disabled={bill.people.length === 0}
          onPress={() => router.push(`/bill/${bill.id}/assign`)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg, gap: space.lg },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    flex: 1,
    color: palette.text,
    backgroundColor: palette.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 13,
  },
  add: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', lineHeight: 30 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.line,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  personDivider: { borderTopWidth: 1, borderTopColor: palette.line },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: palette.bg,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
});
