import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useBills } from '../../../src/data/store';
import { Avatar } from '../../../src/ui/components/Avatar';
import { AppButton, Card, EmptyState, Input, SectionLabel } from '../../../src/ui/components/base';
import { Centered, Screen } from '../../../src/ui/components/Screen';
import { Stagger } from '../../../src/ui/components/Stagger';
import { hairline, palette, radius, space, type as typo } from '../../../src/ui/theme';

export default function People() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getBill, addPerson, removePerson, roster } = useBills();
  const [name, setName] = useState('');
  const bill = getBill(String(id));

  if (!bill) {
    return (
      <Centered>
        <Text style={[typo.body, { color: palette.textSoft }]}>That bill is no longer here.</Text>
      </Centered>
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
    <Screen
      keyboardAware
      dock={
        <AppButton
          label={bill.people.length ? 'Next — who had what' : 'Add someone to continue'}
          disabled={bill.people.length === 0}
          onPress={() => router.push(`/bill/${bill.id}/assign`)}
        />
      }
    >
      <Stagger>
        <Card>
          <SectionLabel>Add everyone at the table</SectionLabel>
          <View style={styles.inputRow}>
            <Input
              value={name}
              onChangeText={setName}
              onSubmitEditing={submit}
              placeholder="Name"
              autoCapitalize="words"
              returnKeyType="done"
              style={{ flex: 1 }}
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
                  <Pressable
                    key={person.id}
                    onPress={() => addPerson(bill.id, person.name)}
                    style={styles.suggestion}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${person.name}`}
                  >
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
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  add: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: palette.onAccent, fontSize: 26, fontWeight: '700', lineHeight: 30 },
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
  personDivider: { borderTopWidth: hairline, borderTopColor: palette.line },
});
