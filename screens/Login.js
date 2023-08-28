import React from 'react';
import {View, Text, StyleSheet, Image, TextInput, TouchableOpacity, Alert,KeyboardAvoidingView, ImageBackground} from 'react-native';

export default class LoginScreen extends React.Component{
  render(){
    return( 
      <View>
        <Text>Pantalla de Acceso</Text>
        <KeyboardAvoidingView behavior="padding" style={styles.container}>
          <ImageBackground sourse={bgImage} style={styles.bgImage}>
            <View style ={styles.upperContainer}>
              <Image sourse={appIcon} style={styles.appIcon}/>
              <Image source={appName} style={styles.appName}/>
            </View>
            <View style={styles.lowerContainer}>
              <TextInput 
                onChangeText={text => this.setState({email:text})}
                placeholder={"Escribe tu correo electronico"}
                autoFocus
              />
              <TextInput 
                style={[styles.textInput, {marginTop:20}]}
                onChangeText={text => this.setState({password:text})}
                placeholder={"Escribe tu contraseña"}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => this.handleLogin(email, password)}
              >
                <Text>Iniciar sesión</Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>
        </KeyboardAvoidingView>
      </View>
    )
  }
}


 const styles = StyleSheet.create({
   loginBox:{
     width:300,
     height:40,
     borderWidth:2,
     fontSize:20,
     margin:10,
     paddingLeft:10
   }
 })