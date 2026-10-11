// PitchCom USB buttons: each button connects D2..D6 to GND.
// No buzzer or external pull-up resistors are needed.
// Upload to Arduino Uno, close Serial Monitor, connect in desktop Chrome/Edge.
const byte COUNT = 5;
const byte pins[COUNT] = {2, 3, 4, 5, 6};
int lastReading[COUNT];
int stableState[COUNT];
unsigned long changedAt[COUNT];
void setup() {
  Serial.begin(9600);
  for (byte i = 0; i < COUNT; i++) {
    pinMode(pins[i], INPUT_PULLUP);
    lastReading[i] = HIGH;
    stableState[i] = HIGH;
    changedAt[i] = 0;
  }
  Serial.println("READY");
}
void loop() {
  unsigned long now = millis();
  for (byte i = 0; i < COUNT; i++) {
    int reading = digitalRead(pins[i]);
    if (reading != lastReading[i]) {
      lastReading[i] = reading;
      changedAt[i] = now;
    }
    if (now - changedAt[i] >= 30 && reading != stableState[i]) {
      stableState[i] = reading;
      if (stableState[i] == LOW) {
        Serial.print("PITCH:");
        Serial.println(i + 1);
      }
    }
  }
}
